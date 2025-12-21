// ViewLoop Secure Monitor - Background Service Worker
// WebSocket-Driven Secure Communication (No hardcoded secrets)

import './socket.io.min.js'; // Ensure it's imported at the top

console.log("🔧 ViewLoop Background - Secure WebSocket Monitor");

let ViewLoopConfig = null;
let socket = null;
const activeSessions = new Map();
const tabSessions = new Map();

async function loadConfig() {
  const result = await chrome.storage.local.get(['viewloop_secure_config']);
  ViewLoopConfig = result.viewloop_secure_config ? JSON.parse(result.viewloop_secure_config) : {
    API_BASE_URL: "http://localhost:3001", // Default to local for dev
    WS_URL: "http://localhost:3001"
  };
  console.log("✅ [CONFIG] Loaded:", ViewLoopConfig);
}

// ==========================
// WEBSOCKET MANAGER
// ==========================
function connectWebSocket(sessionId, sessionToken) {
  if (socket) socket.disconnect();

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

  // THE CORE: Respond to server's pulse request
  socket.on('PULSE_REQUEST', async (data) => {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    // Query content script for latest state or use background state
    // For simplicity and speed, we respond with what we know or ping tab
    chrome.tabs.sendMessage(session.tabId, { type: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Fallback if content script not responding
        return;
      }

      socket.emit('PULSE_RESPONSE', {
        sessionId,
        videoTime: response.videoTime,
        isPlaying: response.isPlaying,
        isFocused: response.isFocused,
        playbackRate: response.playbackRate,
        serverTs: data.ts
      });
      console.log(`💓 [WS] Pulse response sent for ${sessionId}`);
    });
  });

  socket.on('disconnect', () => {
    console.log("🔌 [WS] Disconnected");
  });
}


// ==========================
// MESSAGE HANDLING
// ==========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.type) {
      case 'START_WATCHING':
        handleStartWatching(message, sender, sendResponse);
        return true;

      case 'STOP_WATCHING':
        handleStopWatching(message, sendResponse);
        return false;

      case 'SEND_VIDEO_META':
        // Simplified proxy for meta
        return false;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  } catch (error) {
    console.error(`❌ [BG] Error:`, error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

async function handleStartWatching(message, sender, sendResponse) {
  const { videoId, sessionId: clientSessionId } = message;
  const tabId = sender.tab.id;

  console.log(`🚀 [BG] Starting session for video: ${videoId}`);

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

      // Establish secure socket connection immediately
      connectWebSocket(sessionId, sessionToken);

      sendResponse({ success: true, sessionId });
    } else {
      sendResponse({ success: false, error: data.error || 'SERVER_REJECTED' });
    }
  } catch (err) {
    console.error("❌ Start Watching Error:", err);
    sendResponse({ success: false, error: 'NETWORK_ERROR' });
  }
}

function handleStopWatching(message, sendResponse) {
  const session = activeSessions.get(message.sessionId);
  if (session) {
    console.log(`🛑 [BG] Stopping session: ${message.sessionId}`);
    if (socket) socket.disconnect();
    activeSessions.delete(message.sessionId);
    tabSessions.delete(session.tabId);

    // Final points calculation request
    fetch(`${ViewLoopConfig.API_BASE_URL}/calculate-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: message.sessionId })
    }).then(r => r.json()).then(d => console.log("🏆 Points result:", d));
  }
  sendResponse({ success: true });
}

loadConfig();
