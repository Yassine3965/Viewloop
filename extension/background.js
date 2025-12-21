// ViewLoop Secure Monitor - Background Service Worker
// WebSocket-Driven Secure Communication (No hardcoded secrets)

import { io } from './socket.io.esm.min.js';

console.log("🔧 ViewLoop Background - Secure WebSocket Monitor");

let ViewLoopConfig = null;
let socket = null;
const activeSessions = new Map();
const tabSessions = new Map();

async function loadConfig() {
  const result = await chrome.storage.local.get(['viewloop_secure_config']);
  ViewLoopConfig = result.viewloop_secure_config ? JSON.parse(result.viewloop_secure_config) : {
    API_BASE_URL: "http://localhost:3001",
    WS_URL: "http://localhost:3001"
  };
  console.log("✅ [CONFIG] Config loaded");
}

// ==========================
// WEBSOCKET MANAGER
// ==========================
function connectWebSocket(sessionId, sessionToken) {
  if (socket) {
    console.log("🔌 [WS] Disconnecting previous socket...");
    socket.disconnect();
  }

  console.log(`🔌 [WS] Connecting to ${ViewLoopConfig.WS_URL}...`);
  socket = io(ViewLoopConfig.WS_URL, {
    reconnectionAttempts: 5,
    timeout: 10000
  });

  socket.on('connect', () => {
    console.log("✅ [WS] Connected. Authenticating...");
    socket.emit('AUTH', { sessionId, sessionToken });
  });

  socket.on('AUTH_SUCCESS', () => {
    console.log("🛡️ [WS] Authentication Successful");
  });

  socket.on('AUTH_FAILED', (err) => {
    console.error("❌ [WS] Authentication Failed:", err);
    socket.disconnect();
  });

  socket.on('PULSE_REQUEST', async (data) => {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    chrome.tabs.sendMessage(session.tabId, { type: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response) return;

      socket.emit('PULSE_RESPONSE', {
        sessionId,
        videoTime: response.videoTime,
        isPlaying: response.isPlaying,
        isFocused: response.isFocused,
        playbackRate: response.playbackRate,
        serverTs: data.ts
      });
      console.log(`💓 [WS] Pulse response sent for ${sessionId} at ${response.videoTime}s`);
    });
  });

  socket.on('disconnect', (reason) => {
    console.log("🔌 [WS] Disconnected:", reason);
  });
}

// ==========================
// THROW-AWAY HANDLERS (Legacy compatibility)
// ==========================
function handleLegacyMessage(message, sendResponse) {
  // These messages are no longer needed but we acknowledge them to avoid console errors
  sendResponse({ success: true, legacy: true });
}

// ==========================
// MESSAGE HANDLING
// ==========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 [BG] Message:", message.type);

  try {
    switch (message.type) {
      case 'AUTH_SYNC':
        handleAuthSync(message, sendResponse);
        return true;

      case 'FETCH_PROFILE':
        handleFetchProfile(sendResponse);
        return true;

      case 'START_WATCHING':
        handleStartWatching(message, sender, sendResponse);
        return true;

      case 'STOP_WATCHING':
        handleStopWatching(message, sendResponse);
        return true;

      case 'HEARTBEAT':
      case 'SEND_VIDEO_META':
        handleLegacyMessage(message, sendResponse);
        break;

      case 'GET_SESSIONS':
        sendResponse({
          success: true,
          sessions: Array.from(activeSessions.values())
        });
        break;

      default:
        console.warn("⚠️ [BG] Unknown message type:", message.type);
        sendResponse({ success: false, error: 'Unknown message' });
        break;
    }
  } catch (error) {
    console.error(`❌ [BG] Error handling ${message.type}:`, error);
    sendResponse({ success: false, error: error.message });
  }
  return false; // For cases where we don't return true
});

// External message handling
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTH_SYNC') {
    handleAuthSync(message, sendResponse);
  }
  return true;
});

async function handleFetchProfile(sendResponse) {
  const result = await chrome.storage.local.get(['viewloop_auth_token']);
  const token = result.viewloop_auth_token;
  if (!token) {
    sendResponse({ success: false, error: 'NO_TOKEN' });
    return;
  }

  try {
    const profileUrl = ViewLoopConfig.API_BASE_URL + '/api/user-info';
    const res = await fetch(profileUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();

    if (res.ok && data.name) {
      await chrome.storage.local.set({
        'viewloop_user_name': data.name,
        'viewloop_user_points': data.points,
        'viewloop_user_gems': data.gems,
        'viewloop_user_level': data.level,
        'viewloop_user_avatar': data.avatar
      });
      sendResponse({ success: true, profile: data });
    } else {
      sendResponse({ success: false, error: 'FETCH_FAILED' });
    }
  } catch (err) {
    sendResponse({ success: false, error: 'NETWORK_ERROR' });
  }
}

async function handleAuthSync(message, sendResponse) {
  const { token, userId } = message;
  if (!token) {
    sendResponse({ success: false, error: 'NO_TOKEN' });
    return;
  }

  await chrome.storage.local.set({
    'viewloop_auth_token': token,
    'viewloop_user_id': userId,
    'auth_synced_at': Date.now()
  });

  handleFetchProfile(sendResponse);
}

async function handleStartWatching(message, sender, sendResponse) {
  const { videoId } = message;
  const tabId = sender.tab.id;

  try {
    const result = await chrome.storage.local.get(['viewloop_auth_token']);
    const token = result.viewloop_auth_token;

    const response = await fetch(`${ViewLoopConfig.API_BASE_URL}/start-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, userAuthToken: token })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const { sessionId, sessionToken } = data;
      activeSessions.set(sessionId, { sessionId, videoId, tabId, sessionToken });
      tabSessions.set(tabId, sessionId);
      connectWebSocket(sessionId, sessionToken);
      sendResponse({ success: true, sessionId });
    } else {
      sendResponse({ success: false, error: data.error || 'SERVER_REJECTED' });
    }
  } catch (err) {
    console.error("❌ [BG] Start Watching Network Error:", err);
    sendResponse({ success: false, error: 'NETWORK_ERROR' });
  }
}

function handleStopWatching(message, sendResponse) {
  const session = activeSessions.get(message.sessionId);
  if (session) {
    console.log(`🛑 [BG] Stopping session: ${message.sessionId}`);

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    activeSessions.delete(message.sessionId);
    tabSessions.delete(session.tabId);

    fetch(`${ViewLoopConfig.API_BASE_URL}/calculate-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: message.sessionId })
    }).then(r => r.json())
      .then(d => console.log("🏆 Points result:", d))
      .catch(e => console.error("❌ [BG] Points calculation trigger error:", e));
  }
  sendResponse({ success: true });
}

loadConfig();
