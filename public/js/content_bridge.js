// /public/js/content_bridge.js - ملف إعادة التوجيه النهائي
(function() {
  'use strict';
  
  console.log('🔄 [REDIRECT] تحويل الجسر القديم إلى الجديد...');
  
  // منع التحميل المتعدد
  if (window.__viewloopBridgeRedirected) {
    console.log('⚠️ [REDIRECT] التحويل تم مسبقاً، تخطي...');
    return;
  }
  window.__viewloopBridgeRedirected = true;
  
  // تسجيل تحميل الجسر القديم
  console.error('🚨 [REDIRECT] الجسر القديم تم تحميله من:', 
    new Error().stack.split('\n').slice(2, 5).join('\n')
  );
  
  // لا تقم بأي شيء - فقط سجل الحدث
  // الجسر القديم لن يعمل لأننا سنحمّل الجسر الجديد بعد قليل
  
  // يمكنك اختيارياً تحميل الجسر الجديد بعد فترة
  setTimeout(() => {
    if (!window.__viewloopNewBridgeLoaded && !window.__viewloopFinalBridgeLoaded) {
      console.log('📦 [REDIRECT] تحميل الجسر الجديد...');
      const script = document.createElement('script');
      script.src = '/js/content_bridge.final.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, 500);
  
})();
