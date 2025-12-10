// /public/js/content_bridge.final.js - الجسر النهائي المبسط
(() => {
  'use strict';
  
  console.log('🚀 ViewLoop Bridge FINAL v1.0');
  
  // منع التحميل المزدوج
  if (window.__viewloopFinalBridgeLoaded) {
    console.log('⚠️ Bridge (final) already loaded');
    return;
  }
  window.__viewloopFinalBridgeLoaded = true;
  
  // 🔥 الوظيفة الأساسية: الحصول على التوكن
  function getToken() {
    // الأولوية: userAuthToken
    const token = localStorage.getItem('userAuthToken');
    if (token && token.includes('.')) {
      return token;
    }
    return null;
  }
  
  // 🔥 معالجة رسائل الامتداد
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📩 Bridge (final) message:', request.type);
      
      // 1. PING - اختبار الاتصال
      if (request.type === 'PING') {
        sendResponse({
          type: 'PONG',
          status: 'ready',
          bridge: 'final',
          timestamp: Date.now(),
          hasToken: !!getToken()
        });
        return true;
      }
      
      // 2. REQUEST_AUTH_TOKEN - طلب التوكن
      if (request.type === 'REQUEST_AUTH_TOKEN' || request.type === 'GET_FRESH_FIREBASE_TOKEN') {
        const token = getToken();
        const response = {
          success: !!token,
          timestamp: Date.now(),
          source: 'localStorage/userAuthToken'
        };
        
        if (token) {
          response.authToken = token;
        } else {
          response.error = 'NO_TOKEN';
          response.message = 'No userAuthToken found in localStorage';
        }
        
        sendResponse(response);
        return true;
      }
      
      // 3. أنواع أخرى
      sendResponse({
        success: false,
        error: 'UNKNOWN_TYPE',
        receivedType: request.type
      });
      return true;
    });
    
    console.log('✅ Chrome message handlers ready (final)');
  }
  
  // 🔥 تقرير الحالة
  const token = getToken();
  console.log('📊 Bridge (final) status:', {
    token: token ? '✅ Found' : '❌ Not found',
    firebase: window.firebase ? '✅ Available' : '❌ Not available',
    firebaseType: window.firebase?.__bridgeInitialized ? 'REAL' : 'PLACEHOLDER'
  });
  
  // 🔥 جعل بعض الوظائف متاحة للتصحيح
  window.ViewLoopBridge = {
    version: 'final-1.0',
    getToken: getToken,
    debug: function() {
      return {
        tokenExists: !!token,
        firebaseReady: !!window.firebase?.__bridgeInitialized,
        localStorageKeys: Object.keys(localStorage).filter(k => 
          k.includes('token') || k.includes('auth')
        )
      };
    }
  };
  
})();
