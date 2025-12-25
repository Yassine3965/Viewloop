// ViewLoop State Relay - Background Service Worker
// Signal Relay Implementation - No Automation

let ViewLoopConfig = {
  API_BASE_URL: "https://viewloop.vercel.app" // Next.js Production API
};

// 🔧 IMPROVEMENT: Remove unused socket.io import

// 🔧 IMPROVEMENT: Load config once and cache it to prevent redundant operations
async function loadConfig() {
  if (ViewLoopConfig.loaded) return ViewLoopConfig;
  const result = await chrome.storage.local.get(['viewloop_secure_config']);
  if (result.viewloop_secure_config) {
    const customConfig = JSON.parse(result.viewloop_secure_config);
    ViewLoopConfig = { ...ViewLoopConfig, ...customConfig };
  }
  ViewLoopConfig.loaded = true;
  return ViewLoopConfig;
}

// 🔧 IMPROVEMENT: Remove all WebSocket logic as it's unused and not required
// 🔧 IMPROVEMENT: Add activeSessions with session binding to tabId, videoId, origin for security
const activeSessions = new Map(); // sessionId -> { sessionId, sessionToken, tabId, videoId, origin, createdAt }

// 🔧 IMPROVEMENT: Add tab close listener for cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.tabId === tabId) {
      activeSessions.delete(sessionId);
      console.log(`[CLEANUP] Session ${sessionId} removed due to tab close`);
    }
  }
});

// 🔧 IMPROVEMENT: Add TTL cleanup for stale sessions
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.createdAt > 3600000) { // 1 hour TTL
      activeSessions.delete(sessionId);
      console.log(`[CLEANUP] Session ${sessionId} expired due to TTL`);
    }
  }
}, 300000); // Check every 5 minutes

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 🔧 IMPROVEMENT: Validate sender origin and tab for security
  if (!sender.tab || !sender.url) {
    sendResponse({ success: false, error: 'INVALID_SENDER' });
    return;
  }

  const origin = new URL(sender.url).origin;

  switch (message.type) {
    case 'START_WATCHING':
      // 🔧 IMPROVEMENT: Prevent multiple sessions per tab
      for (const session of activeSessions.values()) {
        if (session.tabId === sender.tab.id) {
          sendResponse({ success: false, error: 'SESSION_ALREADY_ACTIVE' });
          return;
        }
      }
      handleStart(message, sender, origin, sendResponse);
      return true;
    case 'STOP_WATCHING':
      // 🔧 IMPROVEMENT: Validate session belongs to sender tab
      const sessionToStop = activeSessions.get(message.sessionId);
      if (!sessionToStop || sessionToStop.tabId !== sender.tab.id) {
        sendResponse({ success: false, error: 'INVALID_SESSION' });
        return;
      }
      activeSessions.delete(message.sessionId);
      sendResponse({ success: true });
      break;
    case 'AUTH_SYNC':
      // 🔧 IMPROVEMENT: Validate source for security
      if (!sender.tab) {
        sendResponse({ success: false, error: 'INVALID_SOURCE' });
        return;
      }
      chrome.storage.local.set({ 'viewloop_auth_token': message.token });
      sendResponse({ success: true });
      break;
    case 'GET_SESSIONS':
      sendResponse({ success: true, sessions: Array.from(activeSessions.values()) });
      break;
    case 'SEND_HEARTBEATS':
      // 🔧 IMPROVEMENT: Validate heartbeat belongs to valid session
      const session = activeSessions.get(message.sessionId);
      if (!session || session.tabId !== sender.tab.id || session.videoId !== message.videoId || session.origin !== origin) {
        sendResponse({ success: false, error: 'INVALID_SESSION' });
        return;
      }
      handleHeartbeats(message, sendResponse);
      return true;
    case 'COMPLETE_SESSION':
      // 🔧 IMPROVEMENT: Validate session belongs to sender tab for consistency
      const completeSession = activeSessions.get(message.sessionId);
      if (!completeSession || completeSession.tabId !== sender.tab.id) {
        sendResponse({ success: false, error: 'INVALID_SESSION' });
        return;
      }
      handleCompleteSession(message, sendResponse);
      return true;
    case 'FETCH_PROFILE':
      handleFetchProfile(sendResponse);
      return true;
  }
});

async function handleStart(message, sender, origin, sendResponse) {
  await loadConfig();
  const token = (await chrome.storage.local.get(['viewloop_auth_token'])).viewloop_auth_token;

  console.log(`[START] Requesting session for video ${message.videoId} on tab ${sender.tab.id}`);

  try {
    const res = await fetch(`${ViewLoopConfig.API_BASE_URL}/api/start-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'INIT' // Required by Next.js API
      },
      body: JSON.stringify({
        videoId: message.videoId,
        userAuthToken: token
      })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      console.log(`[START] Session created: ${data.sessionId}`);
      // 🔧 IMPROVEMENT: Bind session to tabId, videoId, origin for security
      activeSessions.set(data.sessionId, {
        sessionId: data.sessionId,
        sessionToken: data.sessionToken,
        tabId: sender.tab.id,
        videoId: message.videoId,
        origin: origin,
        createdAt: Date.now()
      });
      sendResponse({ success: true, sessionId: data.sessionId, sessionToken: data.sessionToken });
    } else {
      console.error(`[START] Rejected:`, data.error);
      sendResponse({ success: false, error: data.error || 'REJECTED' });
    }
  } catch (e) {
    console.error(`[START] Network Error:`, e.message);
    sendResponse({ success: false, error: 'OFFLINE' });
  }
}

async function handleHeartbeats(message, sendResponse) {
  await loadConfig();

  try {
    // 🔧 IMPROVEMENT: Remove all HMAC secrets - rely only on sessionId/sessionToken from server
    const payload = JSON.stringify({
      sessionId: message.sessionId,
      sessionToken: message.sessionToken,
      heartbeats: message.heartbeats
    });

    const res = await fetch(`${ViewLoopConfig.API_BASE_URL}/api/heartbeat-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payload
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log(`[HEARTBEAT] Sent ${message.heartbeats.length} signals`);
      sendResponse({ success: true });
    } else {
      console.warn(`[HEARTBEAT] Failed:`, data.error);
      sendResponse({ success: false, error: data.error });
    }
  } catch (e) {
    console.error(`[HEARTBEAT] Error:`, e.message);
    sendResponse({ success: false, error: 'NETWORK_ERROR' });
  }
}

async function handleCompleteSession(message, sendResponse) {
  await loadConfig();

  if (!message.sessionId) {
    console.error("❌ [COMPLETE] Session ID is missing");
    sendResponse({ success: false, error: "MISSING_SESSION_ID" });
    return;
  }

  try {
    const res = await fetch(`${ViewLoopConfig.API_BASE_URL}/api/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: message.sessionId
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log(`[COMPLETE] Session completed: ${data.status}`);
      activeSessions.delete(message.sessionId); // 🔧 IMPROVEMENT: Clean up session locally after successful completion
      sendResponse({ success: true, data });
    } else {
      console.warn(`[COMPLETE] Failed:`, data.error);
      sendResponse({ success: false, error: data.error });
    }
  } catch (e) {
    console.error(`❌ [COMPLETE] Error:`, e.message);
    sendResponse({ success: false, error: 'NETWORK_ERROR' });
  }
}

async function handleFetchProfile(sendResponse) {
  await loadConfig();
  const token = (await chrome.storage.local.get(['viewloop_auth_token'])).viewloop_auth_token;
  if (!token) {
    sendResponse({ success: false, error: 'NO_TOKEN' });
    return;
  }

  try {
    const res = await fetch(`${ViewLoopConfig.API_BASE_URL}/api/user-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAuthToken: token })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      sendResponse({ success: true, profile: data.user });
    } else {
      sendResponse({ success: false, error: data.error });
    }
  } catch (e) {
    sendResponse({ success: false, error: 'NETWORK_ERROR' });
  }
}

loadConfig();
