// extension-compat.js - حل توافق مع الامتداد القديم
(function() {
  'use strict';
  
  console.log('🔧 ViewLoop Extension Compatibility Layer');
  
  // هذا الملف يعمل كطبقة توافق بين الامتداد القديم والموقع الجديد
  
  // 1. الانتظار حتى يحقن الامتداد نفسه
  setTimeout(function() {
    
    // 2. إذا كان الامتداد قد حقن Firebase placeholder
    if (window.firebase && window.firebase.__isPlaceholder) {
      console.log('🔄 تحويل placeholder الامتداد إلى Firebase حقيقي');
      
      // تهيئة Firebase الحقيقية
      const firebaseConfig = {
        apiKey: "AIzaSyBDRLk64HrmlsRKn0BqC3kdmvapOoA_u6g",
        authDomain: "studio-3607665764-5c7db.firebaseapp.com",
        projectId: "studio-3607665764-5c7db",
        storageBucket: "studio-3607665764-5c7db.firebasestorage.app",
        messagingSenderId: "937439846340",
        appId: "1:937439846340:web:0793e5ad6b5c5ea54fce91",
        measurementId: "G-LZY93HSKZR"
      };
      
      // تحميل Firebase SDK إذا لم يكن محملاً
      if (typeof firebase === 'undefined') {
        console.log('📦 تحميل Firebase SDK للامتداد...');
        
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
        script.onload = function() {
          const authScript = document.createElement('script');
          authScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js';
          authScript.onload = function() {
            // الآن Firebase SDK محمّل، قم بالتهيئة
            const app = firebase.initializeApp(firebaseConfig);
            window.firebase = firebase;
            window.firebase.__bridgeInitialized = true;
            console.log('✅ تم تحويل امتداد Chrome لاستخدام Firebase حقيقي');
          };
          document.head.appendChild(authScript);
        };
        document.head.appendChild(script);
      } else {
        // Firebase SDK محمّل مسبقاً
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        window.firebase = firebase;
        window.firebase.__bridgeInitialized = true;
        console.log('✅ تم تحديث Firebase للامتداد');
      }
    }
    
    // 3. إصلاح معالجات رسائل الامتداد
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      console.log('🔧 إصلاح معالجات رسائل الامتداد القديم...');
      
      // أضف معالجاً جديداً فوق المعالج القديم
      const originalListener = chrome.runtime.onMessage.hasListeners ? 
        chrome.runtime.onMessage._listeners[0] : null;
      
      chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        // إذا كان الطلب من الامتداد القديم
        if (request.type === 'GET_FRESH_FIREBASE_TOKEN' || request.type === 'REQUEST_AUTH_TOKEN') {
          console.log('🔄 معالجة طلب من الامتداد القديم:', request.type);
          
          // استخدم التوكن الموجود في localStorage
          const token = localStorage.getItem('userAuthToken');
          
          if (token) {
            sendResponse({
              success: true,
              authToken: token,
              source: 'extension_compat_layer',
              timestamp: Date.now()
            });
          } else {
            sendResponse({
              success: false,
              error: 'NO_TOKEN_IN_STORAGE',
              message: 'Please login to ViewLoop'
            });
          }
          
          return true; // منع المعالج القديم من التنفيذ
        }
        
        // السماح للمعالج الأصلي بالتعامل مع الرسائل الأخرى
        if (originalListener) {
          return originalListener(request, sender, sendResponse);
        }
        
        sendResponse({ success: false, error: 'NO_HANDLER' });
        return true;
      });
      
      console.log('✅ تم إصلاح معالجات الرسائل');
    }
    
  }, 1000); // انتظر ثانية لتحميل الامتداد
  
  // 4. جسر تواصل مع الموقع
  window.ViewLoopExtensionCompat = {
    version: '1.0',
    fixExtensionIssues: function() {
      console.log('🔧 تطبيق إصلاحات الامتداد...');
      
      // إصلاح Firebase
      if (window.firebase && window.firebase.__isPlaceholder) {
        window.firebase.__isPlaceholder = false;
        window.firebase.__bridgeInitialized = true;
      }
      
      return {
        fixed: true,
        firebaseReady: !!window.firebase?.__bridgeInitialized,
        hasToken: !!localStorage.getItem('userAuthToken')
      };
    }
  };
  
  console.log('✅ طبقة التوافق مع الامتداد جاهزة');
})();
