// ViewLoop Secure Monitor - Background Service Worker
console.log("🔧 ViewLoop Background - Secure Monitor");

// ==========================
// CONFIGURATION LOADING
// ==========================
let ViewLoopConfig = null;

async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['viewloop_secure_config']);
    if (result.viewloop_secure_config) {
      ViewLoopConfig = JSON.parse(result.viewloop_secure_config);
      console.log("✅ [CONFIG] Loaded from storage");
    } else {
      // Fallback config
      ViewLoopConfig = {
        API_BASE_URL: "https://viewloop.vercel.app",
        ENDPOINTS: {
          START_SESSION: '/api/start-session',
          HEARTBEAT: '/api/heartbeat-data'
        }
      };
      console.log("⚠️ [CONFIG] Using fallback config");
    }
  } catch (error) {
    console.error("❌ [CONFIG] Failed to load:", error);
    ViewLoopConfig = {
      API_BASE_URL: "https://viewloop.vercel.app"
    };
  }
}

// ==========================
// API CLIENT
// ==========================
const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

async function generateSignature(data) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(EXTENSION_SECRET);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const bodyData = encoder.encode(JSON.stringify(data));
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, bodyData);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendHeartbeatBatch(sessionId, videoId, heartbeats) {
  if (!ViewLoopConfig) {
    console.error("❌ [API] Config not loaded");
    return { success: false, error: 'CONFIG_NOT_LOADED' };
  }

  const url = ViewLoopConfig.API_BASE_URL + '/api/heartbeat-batch';
  const body = {
    sessionId,
    videoId,
    heartbeats,
    timestamp: Date.now(),
    clientType: 'extension'
  };

  try {
    const signature = await generateSignature(body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ [API] Heartbeat batch sent for session ${sessionId}: ${heartbeats.length} heartbeats`);
      return { success: true, result };
    } else {
      console.error(`❌ [API] Batch failed: ${response.status}`, result);
      return { success: false, error: result.error || 'HTTP_ERROR' };
    }
  } catch (error) {
    console.error(`❌ [API] Network error sending batch:`, error);
    return { success: false, error: 'NETWORK_ERROR' };
  }
}

async function sendHeartbeat(sessionId, heartbeatData) {
  // Not heavily used if batching is active, but upgrading for consistency
  if (!ViewLoopConfig) {
    console.error("❌ [API] Config not loaded");
    return { success: false, error: 'CONFIG_NOT_LOADED' };
  }

  const url = ViewLoopConfig.API_BASE_URL + ViewLoopConfig.ENDPOINTS.HEARTBEAT;
  const body = {
    sessionId,
    ...heartbeatData,
    clientType: 'extension'
  };

  try {
    // If backend requires signature for single heartbeat, we add it. 
    // Assuming backend standardizes on signature:
    const signature = await generateSignature(body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ [API] Heartbeat sent for session ${sessionId}`);
      return { success: true, result };
    } else {
      console.error(`❌ [API] Failed: ${response.status}`, result);
      return { success: false, error: result.error || 'HTTP_ERROR' };
    }
  } catch (error) {
    console.error(`❌ [API] Network error:`, error);
    return { success: false, error: 'NETWORK_ERROR' };
  }
}

// ==========================
// SESSION MANAGEMENT
// ==========================
const activeSessions = new Map();
const tabSessions = new Map();

function createSession(sessionId, videoId, tabId) {
  console.log(`🔐 [SESSION] Creating session: ${sessionId} for tab ${tabId}`);

  // Remove existing session for this tab
  if (tabSessions.has(tabId)) {
    const existingId = tabSessions.get(tabId);
    activeSessions.delete(existingId);
  }

  const session = {
    sessionId,
    videoId,
    tabId,
    startTime: Date.now(),
    lastHeartbeat: Date.now(),
    heartbeats: [],
    validHeartbeats: 0
  };

  activeSessions.set(sessionId, session);
  tabSessions.set(tabId, sessionId);

  console.log(`✅ [SESSION] Session created: ${sessionId}`);
  return session;
}

function endSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  session.endTime = Date.now();
  tabSessions.delete(session.tabId);

  console.log(`🛑 [SESSION] Session ended: ${sessionId}`);
  return session;
}

function getSession(sessionId) {
  return activeSessions.get(sessionId);
}

// ==========================
// BASIC EVENT LISTENERS
// ==========================
chrome.runtime.onInstalled.addListener(async () => {
  console.log("✅ Service Worker installed successfully");
  await loadConfig();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("🚀 Service Worker started");
  await loadConfig();
});

// ==========================
// MESSAGE HANDLING
// ==========================
// ==========================
// EXTERNAL MESSAGE HANDLING (FROM WEB APP)
// ==========================
chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  console.log("📨 [BG] External message received:", message.type, "from", sender.url);

  if (message.type === 'AUTH_SYNC') {
    const { token, userId } = message;
    if (token) {
      await chrome.storage.local.set({
        'viewloop_auth_token': token,
        'viewloop_user_id': userId,
        'auth_synced_at': Date.now()
      });
      console.log("✅ [AUTH] Token synced from web app for user:", userId);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'NO_TOKEN' });
    }
  }
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 [BG] Message received:", message.type);

  try {
    switch (message.type) {
      case 'PING':
      case 'GET_CONFIG':
        sendResponse({ success: true, config: ViewLoopConfig });
        return false;

      case 'FETCH_PROFILE':
        handleFetchProfile(sendResponse);
        return true;

      case 'AUTH_SYNC':
        handleAuthSync(message, sendResponse);
        return true;

      case 'START_WATCHING':
        handleStartWatching(message, sender, sendResponse);
        return true;

      case 'HEARTBEAT':
        handleHeartbeat(message, sendResponse);
        return false;

      case 'STOP_WATCHING':
        handleStopWatching(message, sendResponse);
        return false;

      case 'SEND_VIDEO_META':
        handleSendVideoMeta(message, sendResponse);
        return false;

      case 'GET_SESSIONS':
        sendResponse({ success: true, sessions: Array.from(activeSessions.values()) });
        return false;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  } catch (error) {
    console.error(`❌ [BG] Error handling message ${message.type}:`, error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

// Helper Functions for Messages
async function handleFetchProfile(sendResponse) {
  chrome.storage.local.get(['viewloop_auth_token'], async (result) => {
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
  });
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
      sendResponse({ success: true, warning: 'PROFILE_FETCH_FAILED' });
    }
  } catch (err) {
    sendResponse({ success: true, warning: 'NETWORK_ERROR' });
  }
}

async function handleStartWatching(message, sender, sendResponse) {
  const session = createSession(message.sessionId, message.videoId, sender.tab.id);

  try {
    const result = await chrome.storage.local.get(['viewloop_auth_token']);
    const token = result.viewloop_auth_token;

    if (!token) {
      console.error("❌ [BG] No auth token available for session start");
      sendResponse({ success: false, error: 'NO_AUTH_TOKEN' });
      return;
    }

    const response = await fetch(ViewLoopConfig.API_BASE_URL + ViewLoopConfig.ENDPOINTS.START_SESSION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'INIT'
      },
      body: JSON.stringify({
        videoId: message.videoId,
        sessionId: message.sessionId,
        userAuthToken: token,
        clientType: 'extension'
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      if (data.video && data.video.duration) {
        session.duration = data.video.duration;
        console.log(`✅ [BG] Session Authorized. Video: ${message.videoId}, Duration: ${session.duration}s`);
        sendResponse({ success: true, session });
      } else {
        console.warn(`⚠️ [BG] Session started but no duration provided`);
        sendResponse({ success: true, session });
      }
    } else {
      console.error(`❌ [BG] Server rejected session: ${data.error || response.statusText}`);
      // If rejected by server, cleanup local session immediately
      endSession(message.sessionId);
      sendResponse({
        success: false,
        error: data.error || 'SERVER_REJECTION',
        message: data.message || 'Video not authorized'
      });
    }
  } catch (err) {
    console.error("❌ [BG] Error in handleStartWatching:", err);
    sendResponse({ success: false, error: 'INTERNAL_ERROR' });
  }
}

function handleHeartbeat(message, sendResponse) {
  const session = getSession(message.sessionId);
  if (!session) {
    sendResponse({ success: false, error: 'SESSION_NOT_FOUND' });
    return;
  }

  session.lastHeartbeat = Date.now();
  session.heartbeats.push(message);
  session.validHeartbeats++;

  if (!session.pendingHeartbeats) session.pendingHeartbeats = [];
  session.pendingHeartbeats.push({ t: message.t, p: message.p, v: message.v, f: message.f });

  if (session.pendingHeartbeats.length >= 6 || message.isFinal) {
    const batch = [...session.pendingHeartbeats];
    if (message.isFinal) batch[batch.length - 1].isFinal = true;
    session.pendingHeartbeats = [];
    sendHeartbeatBatch(session.sessionId, session.videoId, batch).catch(e => {
      session.pendingHeartbeats.unshift(...batch);
    });
  }
  sendResponse({ success: true });
}

function handleStopWatching(message, sendResponse) {
  const session = getSession(message.sessionId);
  if (session) {
    const batch = session.pendingHeartbeats || [];
    if (batch.length > 0) batch[batch.length - 1].isFinal = true;
    else batch.push({ t: Math.floor((Date.now() - session.startTime) / 1000), p: false, v: true, f: true, isFinal: true });
    sendHeartbeatBatch(session.sessionId, session.videoId, batch).catch(e => console.error("❌ [BG] Final Batch Fail:", e));
  }
  const endedSession = endSession(message.sessionId);
  sendResponse({ success: true, session: endedSession });
}

function handleSendVideoMeta(message, sendResponse) {
  const session = message.sessionId ? getSession(message.sessionId) : null;
  if (session && (!session.duration || session.duration === 0)) {
    session.duration = message.duration;
  }
  chrome.storage.local.get(['viewloop_auth_token'], (result) => {
    fetch(ViewLoopConfig.API_BASE_URL + '/api/video-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: message.videoId, duration: message.duration, clientType: 'extension', userAuthToken: result.viewloop_auth_token })
    }).catch(e => console.error("❌ [BG] Meta Fail:", e));
  });
  sendResponse({ success: true });
}

console.log("🎯 Service Worker loaded and ready");

// Load config on startup
loadConfig();
