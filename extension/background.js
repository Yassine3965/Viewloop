// ViewLoop Secure Monitor - Background Service Worker
// "Pulse Device" Minimal Implementation

import { io } from './socket.io.esm.min.js';

let ViewLoopConfig = {
  API_BASE_URL: "https://viewloop.vercel.app", // Next.js Production API
  WS_URL: null  // WebSocket disabled - Vercel doesn't support WS servers
};

let socket = null;
const activeSessions = new Map();

async function loadConfig() {
  const result = await chrome.storage.local.get(['viewloop_secure_config']);
  if (result.viewloop_secure_config) {
    const customConfig = JSON.parse(result.viewloop_secure_config);
    ViewLoopConfig = { ...ViewLoopConfig, ...customConfig };
  }
}

function connectWebSocket(sessionId, sessionToken, videoId) {
  if (!ViewLoopConfig.WS_URL) {
    console.log('⚠️ [WS] WebSocket disabled - using REST API only');
    return;
  }

  if (socket) socket.disconnect();

  console.log(`🔌 [WS] Connecting to Pulse Brain: ${ViewLoopConfig.WS_URL}`);
  socket = io(ViewLoopConfig.WS_URL, {
    reconnectionAttempts: 10,
    transports: ['websocket']
  });

  socket.on('connect', () => {
    console.log(`✅ [WS] Connected. Authenticating session ${sessionId}`);
    socket.emit('AUTH', { sessionId, sessionToken, videoId });
  });

  socket.on('PULSE_REQUEST', (data) => {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    // Ask tab for current state
    chrome.tabs.sendMessage(session.tabId, { type: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // If tab is dead/cloased, we just don't respond. The server will detect this.
        return;
      }

      socket.emit('PULSE_RESPONSE', {
        sessionId,
        isPlaying: response.isPlaying,
        isTabActive: response.isTabActive,
        isEnded: response.isEnded,
        videoTime: response.videoTime
      });
    });
  });

  socket.on('disconnect', () => {
    console.warn("🔌 [WS] Disconnected from Pulse Brain");
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_WATCHING':
      handleStart(message, sender, sendResponse);
      return true;
    case 'STOP_WATCHING':
      activeSessions.delete(message.sessionId);
      if (socket) socket.disconnect();
      sendResponse({ success: true });
      break;
    case 'AUTH_SYNC':
      chrome.storage.local.set({ 'viewloop_auth_token': message.token });
      sendResponse({ success: true });
      break;
    case 'GET_SESSIONS':
      sendResponse({ success: true, sessions: Array.from(activeSessions.values()) });
      break;
  }
});

async function handleStart(message, sender, sendResponse) {
  await loadConfig();
  const token = (await chrome.storage.local.get(['viewloop_auth_token'])).viewloop_auth_token;

  console.log(`🚀 [START] Requesting session for video ${message.videoId}`);

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
      console.log(`✅ [START] Session created: ${data.sessionId}`);
      activeSessions.set(data.sessionId, { ...data, tabId: sender.tab.id });
      connectWebSocket(data.sessionId, data.sessionToken, message.videoId);
      sendResponse({ success: true, sessionId: data.sessionId });
    } else {
      console.error(`❌ [START] Rejected:`, data.error);
      sendResponse({ success: false, error: data.error || 'REJECTED' });
    }
  } catch (e) {
    console.error(`❌ [START] Network Error:`, e.message);
    sendResponse({ success: false, error: 'OFFLINE' });
  }
}

loadConfig();
