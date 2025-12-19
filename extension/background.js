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
async function sendHeartbeat(sessionId, heartbeatData) {
  if (!ViewLoopConfig) {
    console.error("❌ [API] Config not loaded");
    return { success: false, error: 'CONFIG_NOT_LOADED' };
  }

  const url = ViewLoopConfig.API_BASE_URL + ViewLoopConfig.ENDPOINTS.HEARTBEAT;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        ...heartbeatData,
        clientType: 'extension'
      })
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
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("📨 [BG] Message received:", message.type);

  switch (message.type) {
    case 'PING':
      sendResponse({ success: true, config: ViewLoopConfig });
      break;

    case 'GET_CONFIG':
      sendResponse({ success: true, config: ViewLoopConfig });
      break;

    case 'START_WATCHING':
      try {
        const session = createSession(message.sessionId, message.videoId, sender.tab.id);
        sendResponse({ success: true, session });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'HEARTBEAT':
      try {
        const session = getSession(message.sessionId);
        if (!session) {
          sendResponse({ success: false, error: 'SESSION_NOT_FOUND' });
          return;
        }

        session.lastHeartbeat = Date.now();
        session.heartbeats.push(message);
        session.validHeartbeats++;

        // Convert new format to old format for server compatibility
        const serverHeartbeat = {
          sessionId: message.sessionId,
          videoId: session.videoId,
          videoTime: message.t,           // t -> videoTime
          isPlaying: message.p,           // p -> isPlaying
          tabActive: message.v,           // v -> tabActive (visibility)
          windowFocused: message.f,       // f -> windowFocused
          mouseActive: true,              // default to true (behavioral pattern)
          lastMouseMove: Date.now(),
          sessionDuration: Math.floor((Date.now() - session.startTime) / 1000),
          totalHeartbeats: session.validHeartbeats
        };

        // Send to server asynchronously
        sendHeartbeat(message.sessionId, serverHeartbeat).catch(error => {
          console.error(`❌ [BG] Failed to send heartbeat:`, error);
        });

        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'STOP_WATCHING':
      try {
        const session = endSession(message.sessionId);
        sendResponse({ success: true, session });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'GET_SESSIONS':
      sendResponse({
        success: true,
        sessions: Array.from(activeSessions.values())
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

console.log("🎯 Service Worker loaded and ready");

// Load config on startup
loadConfig();
