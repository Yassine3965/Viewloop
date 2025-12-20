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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("📨 [BG] Message received:", message.type);

  switch (message.type) {
    case 'PING':
      sendResponse({ success: true, config: ViewLoopConfig });
      break;

    case 'GET_CONFIG':
      sendResponse({ success: true, config: ViewLoopConfig });
      break;

    case 'AUTH_SYNC':
      const { token, userId } = message;
      if (token) {
        await chrome.storage.local.set({
          'viewloop_auth_token': token,
          'viewloop_user_id': userId,
          'auth_synced_at': Date.now()
        });
        console.log("✅ [BG-INTERNAL] Token synced from content script for user:", userId);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'NO_TOKEN' });
      }
      break;

    case 'START_WATCHING':
      try {
        const session = createSession(message.sessionId, message.videoId, sender.tab.id);

        // 🚀 CRITICAL: Register session with server using Auth Token
        // Must retrieve token from storage first
        chrome.storage.local.get(['viewloop_auth_token'], (result) => {
          const token = result.viewloop_auth_token;
          if (token) {
            console.log("🔐 [BG] Found auth token, registering session with server...");
            const startSessionUrl = ViewLoopConfig.API_BASE_URL + ViewLoopConfig.ENDPOINTS.START_SESSION;

            // Construct SHA-256 signature for INIT if needed or rely on token
            // Server expects x-signature: 'INIT' for start-session as per my previous view of route.ts

            fetch(startSessionUrl, {
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
            }).then(res => res.json())
              .then(data => {
                if (data.success) {
                  console.log("✅ [BG] Session registered on server with User ID:", data.userId || 'unknown');
                } else {
                  console.warn("⚠️ [BG] Server rejected session registration:", data);
                }
              })
              .catch(err => console.error("❌ [BG] Failed to register session:", err));
          } else {
            console.log("⚠️ [BG] No auth token found, session will be anonymous");
          }
        });

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

        // Store heartbeat in session for batch processing
        if (!session.pendingHeartbeats) {
          session.pendingHeartbeats = [];
        }

        session.pendingHeartbeats.push({
          t: message.t,    // time
          p: message.p,    // playing
          v: message.v,    // visibility
          f: message.f     // focus
        });

        // Send batch every 30 seconds or when session ends
        const shouldSendBatch = session.pendingHeartbeats.length >= 6 || message.isFinal; // 6 heartbeats = 30 seconds

        if (shouldSendBatch) {
          const batchToSend = [...session.pendingHeartbeats];
          session.pendingHeartbeats = []; // Clear pending

          // Add isFinal flag if session is ending
          if (message.isFinal) {
            batchToSend.push({ ...batchToSend[batchToSend.length - 1], isFinal: true });
          }

          // Send batch to server
          sendHeartbeatBatch(session.sessionId, session.videoId, batchToSend).catch(error => {
            console.error(`❌ [BG] Failed to send heartbeat batch:`, error);
            // Re-queue failed heartbeats
            session.pendingHeartbeats.unshift(...batchToSend);
          });
        }

        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'STOP_WATCHING':
      try {
        const session = getSession(message.sessionId);
        if (session) {
          console.log(`🛑 [BG] Finalizing session ${session.sessionId}`);
          // Flush any pending heartbeats with isFinal=true
          const batchToSend = session.pendingHeartbeats || [];

          // If we have pending heartbeats, use the last one as final.
          if (batchToSend.length > 0) {
            batchToSend[batchToSend.length - 1].isFinal = true;
          } else {
            // Create a synthetic final heartbeat
            batchToSend.push({
              t: Math.floor((Date.now() - session.startTime) / 1000), // Estimate time
              p: false,
              v: true,
              f: true,
              isFinal: true
            });
          }

          // Send to server DO NOT AWAIT (or await if careful)
          sendHeartbeatBatch(session.sessionId, session.videoId, batchToSend)
            .then(res => console.log(`🏁 [BG] Session finalized on server: ${res.success}`))
            .catch(err => console.error(`❌ [BG] Failed to finalize session:`, err));
        }

        const endedSession = endSession(message.sessionId);
        sendResponse({ success: true, session: endedSession });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'SEND_VIDEO_META':
      try {
        console.log("📊 [BG] Sending video metadata for:", message.videoId);
        chrome.storage.local.get(['viewloop_auth_token'], (result) => {
          const token = result.viewloop_auth_token;
          const metaUrl = ViewLoopConfig.API_BASE_URL + '/api/video-meta';

          fetch(metaUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
              // Add signature if needed, but this endpoint might be public or rely on body token?
              // Assuming standard public/auth is fine. If it needs auth, we can add it.
            },
            body: JSON.stringify({
              videoId: message.videoId,
              duration: message.duration,
              clientType: 'extension',
              userAuthToken: token // Optional if backend uses it
            })
          })
            .then(res => res.json())
            .then(data => {
              console.log("✅ [BG] Video metadata sent:", data);
              // We don't necessarily need to send response back to content script async here as it's fire-and-forget mostly
            })
            .catch(err => console.error("❌ [BG] Failed to send video metadata:", err));
        });
        sendResponse({ success: true }); // Ack immediately
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
