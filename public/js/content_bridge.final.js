// /public/js/content_bridge.final.js - الجسر النهائي المبسط
(() => {
  'use strict';
  
  if (window.__viewloopFinalBridgeLoaded) return;
  window.__viewloopFinalBridgeLoaded = true;

  console.log('🚀 ViewLoop Final Bridge v1.1 Loaded');

  function getToken() {
    return localStorage.getItem('userAuthToken');
  }

  function setupYouTubeTokenSharing(token) {
    if (!token) return;
    try {
      sessionStorage.setItem('viewloop_auth_token', token);
      console.log('✅ Token shared to sessionStorage for YouTube.');
    } catch (e) {
      console.error('Could not share token', e);
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'PING') {
        sendResponse({ type: 'PONG', source: 'final_bridge' });
        return true;
      }
      
      if (request.type === 'REQUEST_AUTH_TOKEN' || request.type === 'GET_TOKEN_FOR_YOUTUBE') {
        const token = getToken();
        if (token) {
          setupYouTubeTokenSharing(token);
          sendResponse({ success: true, token: token, source: 'final_bridge' });
        } else {
          sendResponse({ success: false, error: 'NO_TOKEN' });
        }
        return true;
      }

    });
  }

  const existingToken = getToken();
  if (existingToken) {
    setTimeout(() => setupYouTubeTokenSharing(existingToken), 500);
  }

})();
