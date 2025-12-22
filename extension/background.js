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

  socket.on('AUTH_SUCCESS', () => {
    console.log(`✅ [WS] Authenticated: ${sessionId}`);
  });

  socket.on('PULSE_REQUEST', async (data) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATE' });
    if (response) {
      socket.emit('PULSE_RESPONSE', {
        sessionId,
        ...response,
        timestamp: Date.now()
      });
    }
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
    case 'SEND_HEARTBEATS':
      handleHeartbeats(message, sendResponse);
      return true;
    case 'COMPLETE_SESSION':
      handleCompleteSession(message, sendResponse);
      return true;
    case 'FETCH_PROFILE':
      handleFetchProfile(sendResponse);
      return true;
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
      sendResponse({ success: true, sessionId: data.sessionId, sessionToken: data.sessionToken });
    } else {
      console.error(`❌ [START] Rejected:`, data.error);
      sendResponse({ success: false, error: data.error || 'REJECTED' });
    }
  } catch (e) {
    console.error(`❌ [START] Network Error:`, e.message);
    sendResponse({ success: false, error: 'OFFLINE' });
  }
}

async function handleHeartbeats(message, sendResponse) {
  await loadConfig();

  try {
    // Generate signature for authentication
    const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";
    const payload = JSON.stringify({
      sessionId: message.sessionId,
      sessionToken: message.sessionToken,
      heartbeats: message.heartbeats
    });

    // Create HMAC signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(EXTENSION_SECRET);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const res = await fetch(`${ViewLoopConfig.API_BASE_URL}/api/heartbeat-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signatureHex
      },
      body: payload
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log(`💓 [HEARTBEAT] Sent ${message.heartbeats.length} heartbeats`);
      sendResponse({ success: true });
    } else {
      console.warn(`⚠️ [HEARTBEAT] Failed:`, data.error);
      sendResponse({ success: false, error: data.error });
    }
  } catch (e) {
    console.error(`❌ [HEARTBEAT] Error:`, e.message);
    sendResponse({ success: false, error: 'NETWORK_ERROR' });
  }
}

async function handleCompleteSession(message, sendResponse) {
  await loadConfig();

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
      console.log(`✅ [COMPLETE] Session completed. Status: ${data.status}`);
      sendResponse({ success: true, data });
    } else {
      console.warn(`⚠️ [COMPLETE] Failed:`, data.error);
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
