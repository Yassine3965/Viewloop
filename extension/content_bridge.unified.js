// content_bridge.unified.js - الجسر الموحد لجميع الحالات (v4.0 - Updated Token System)
(function() {
  'use strict';

  console.log('🚀 ViewLoop Unified Bridge v4.0 - Updated Token System');

  // ⭐ منع التحميل المزدوج نهائياً ⭐
  if (window.__viewloopUnifiedBridgeLoaded) {
    console.log('⚠️ الجسر الموحد محمّل مسبقاً، تخطي...');
    return;
  }
  window.__viewloopUnifiedBridgeLoaded = true;

  // 🔥 الكشف عن البيئة
  const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage;
  const isInIframe = window !== window.top;
  const isYouTube = window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be');

  console.log('📊 بيئة الجسر:', {
    chromeExtension: isChromeExtension,
    inIframe: isInIframe,
    isYouTube: isYouTube,
    location: window.location.href
  });

  // ===================== نظام التوكن الجديد =====================
  // ⭐ لا يعتمد على window.firebase ⭐

  const TOKEN_CONFIG = {
    PRIMARY_KEY: 'userAuthToken',
    FALLBACK_KEYS: ['authToken', 'firebaseToken', 'token'],
    VALIDITY_THRESHOLD: 5 * 60 * 1000, // 5 دقائق
    VERSION: '4.0'
  };

  // 🔥 نظام الأمان الديناميكي للسر
  const SECRET_CONFIG = {
    BASE_SECRET: '6B65FDC657B5D8CF4D5AB28C92CF2', // المفتاح الأساسي
    WINDOW_MINUTES: 5, // نافذة زمنية صالحة (5 دقائق)
    HASH_ALGORITHM: 'SHA-256' // خوارزمية التجزئة
  };

  // 🔥 دالة توليد سر ديناميكي
  async function generateDynamicSecret(timestamp = Date.now()) {
    const windowStart = Math.floor(timestamp / (SECRET_CONFIG.WINDOW_MINUTES * 60 * 1000));
    const data = `${SECRET_CONFIG.BASE_SECRET}:${windowStart}`;

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest(SECRET_CONFIG.HASH_ALGORITHM, dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16).toUpperCase();
    } catch (e) {
      // في حالة عدم توفر Web Crypto API، استخدم طريقة بديلة
      console.warn('⚠️ Web Crypto غير متوفر، استخدام طريقة بديلة للسر');
      return btoa(data).substring(0, 16).toUpperCase();
    }
  }

  // 🔥 دالة التحقق من السر الديناميكي
  async function validateDynamicSecret(providedSecret, timestamp = Date.now()) {
    if (!providedSecret) return false;

    const now = Date.now();
    const timeDiff = Math.abs(now - timestamp);

    // التحقق من أن الطابع الزمني ضمن النافذة المسموحة
    if (timeDiff > SECRET_CONFIG.WINDOW_MINUTES * 60 * 1000) {
      console.log('⏰ السر منتهي الصلاحية');
      return false;
    }

    // توليد السر المتوقع للطابع الزمني المقدم
    const expectedSecret = await generateDynamicSecret(timestamp);

    // مقارنة السر المقدم مع المتوقع
    const isValid = providedSecret.toUpperCase() === expectedSecret;

    if (!isValid) {
      console.log('🔒 سر غير صالح:', {
        provided: providedSecret.substring(0, 8) + '...',
        expected: expectedSecret.substring(0, 8) + '...',
        timestamp: new Date(timestamp).toISOString()
      });
    }

    return isValid;
  }

  // 🔥 دالة جديدة: البحث عن التوكن بدون Firebase
  function findAuthTokenSmart() {
    console.log('🔍 البحث الذكي عن التوكن...');

    // المحاولة 1: userAuthToken المباشر
    const primaryToken = localStorage.getItem(TOKEN_CONFIG.PRIMARY_KEY);
    if (primaryToken && isValidJWT(primaryToken)) {
      console.log('✅ وجدت userAuthToken صالح');
      return {
        success: true,
        token: primaryToken,
        source: TOKEN_CONFIG.PRIMARY_KEY,
        type: 'jwt_direct'
      };
    }

    // المحاولة 2: المفاتيح الاحتياطية
    for (const key of TOKEN_CONFIG.FALLBACK_KEYS) {
      const token = localStorage.getItem(key);
      if (token && isValidJWT(token)) {
        console.log(`✅ وجدت ${key} صالح`);
        return {
          success: true,
          token: token,
          source: key,
          type: 'jwt_fallback'
        };
      }
    }

    // المحاولة 3: إذا كان Firebase متاحاً (للتوافق مع الإصدارات القديمة)
    if (window.firebase && typeof window.firebase.auth === 'function') {
      try {
        const auth = window.firebase.auth();
        if (auth.currentUser) {
          console.log('👤 مستخدم Firebase موجود:', auth.currentUser.email);
          return {
            success: true,
            token: null, // سيتم الحصول عليه لاحقاً
            source: 'firebase_legacy',
            user: auth.currentUser,
            type: 'firebase_legacy'
          };
        }
      } catch (e) {
        console.log('⚠️ Firebase legacy access failed:', e.message);
      }
    }

    // المحاولة 4: أي JWT في localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (value && isValidJWT(value)) {
        console.log(`🎯 وجدت JWT في ${key}`);
        return {
          success: true,
          token: value,
          source: key,
          type: 'jwt_any'
        };
      }
    }

    console.log('❌ لم أجد أي توكن صالح');
    return {
      success: false,
      error: 'NO_VALID_TOKEN',
      message: 'No valid authentication token found'
    };
  }

  // 🔥 دالة التحقق من JWT
  function isValidJWT(token) {
    if (!token || typeof token !== 'string') return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    try {
      const payload = JSON.parse(atob(parts[1]));
      const expiry = payload.exp * 1000;
      const now = Date.now();

      // التحقق من الصلاحية مع هامش 5 دقائق
      return (expiry - now) > TOKEN_CONFIG.VALIDITY_THRESHOLD;
    } catch (e) {
      return false;
    }
  }

  // 🔥 دالة جديدة: الحصول على توكن جديد
  async function getFreshToken(tokenInfo) {
    console.log('🔄 محاولة الحصول على توكن جديد...');

    // إذا كان التوكن من Firebase قديم
    if (tokenInfo.type === 'firebase_legacy' && tokenInfo.user) {
      try {
        const freshToken = await tokenInfo.user.getIdToken(true);
        console.log('✅ حصلت على توكن جديد من Firebase');
        return {
          success: true,
          token: freshToken,
          source: 'firebase_fresh',
          isFresh: true
        };
      } catch (error) {
        console.error('❌ فشل في تجديد توكن Firebase:', error);
        return {
          success: false,
          error: 'FIREBASE_REFRESH_FAILED',
          message: error.message
        };
      }
    }

    // إذا كان JWT عادي، نحتاج إلى طريقة لتجديده
    console.log('⚠️ JWT يحتاج تجديد عبر API');
    return {
      success: false,
      error: 'NEEDS_API_REFRESH',
      message: 'JWT token needs API refresh'
    };
  }

  // 🔥 دالة الحصول على التوكن الموحدة
  function getTokenUnified() {
    console.log('⚡ الحصول على التوكن (Unified v4.0)...');

    const tokenInfo = findAuthTokenSmart();
    if (tokenInfo.success) {
      console.log(`🎯 وجدت توكن: ${tokenInfo.source}`);
      return tokenInfo;
    }

    console.log('❌ لا توجد توكنات صالحة');
    return null;
  }

  // 🔥 دالة إرسال الرسائل الموحدة مع timeout و retry
  function sendMessageUnified(message, options = {}) {
    const {
      timeout = 5000, // 5 ثوانٍ كافتراضي
      retryCount = 2,  // عدد المحاولات (0 للإلغاء)
      retryDelay = 1000 // تأخير بين المحاولات بالميلي ثانية
    } = options;

    return new Promise(async (resolve) => {
      if (!isChromeExtension) {
        console.log('⚠️ بيئة Chrome غير متوفرة، لا يمكن إرسال الرسالة');
        resolve({ success: false, error: 'NO_CHROME_EXTENSION' });
        return;
      }

      let attempts = 0;
      const maxAttempts = retryCount + 1; // المحاولة الأولى + retries

      const attemptSend = () => {
        attempts++;
        console.log(`📤 محاولة إرسال الرسالة (${attempts}/${maxAttempts})`);

        // إنشاء Promise للإرسال
        const sendPromise = new Promise((resolveSend) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              console.log(`⚠️ فشل في إرسال الرسالة (${attempts}):`, chrome.runtime.lastError.message);
              resolveSend({ success: false, error: chrome.runtime.lastError.message });
            } else {
              // التحقق العميق من الرد
              if (response && typeof response === 'object') {
                if (response.success !== undefined) {
                  console.log(`✅ رد الرسالة (${attempts}):`, response.success ? 'نجح' : 'فشل');
                } else {
                  console.log(`📋 رد الرسالة (${attempts}):`, response);
                }
              } else {
                console.log(`📋 رد الرسالة (${attempts}):`, response);
              }
              resolveSend(response || { success: true });
            }
          });
        });

        // إنشاء Promise للtimeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`TIMEOUT_AFTER_${timeout}ms`));
          }, timeout);
        });

        // استخدام Promise.race للtimeout
        Promise.race([sendPromise, timeoutPromise])
          .then((result) => {
            resolve(result);
          })
          .catch((error) => {
            console.log(`⏰ انتهاء الوقت (${attempts}):`, error.message);

            // إذا لم نصل للحد الأقصى، أعد المحاولة
            if (attempts < maxAttempts) {
              console.log(`🔄 إعادة المحاولة في ${retryDelay}ms...`);
              setTimeout(attemptSend, retryDelay);
            } else {
              // نفدت المحاولات
              resolve({
                success: false,
                error: 'MAX_RETRIES_EXCEEDED',
                attempts: attempts,
                lastError: error.message
              });
            }
          });
      };

      // بدء المحاولة الأولى
      attemptSend();
    });
  }

  // ===================== الجسر المبسط (للموقع) =====================
  function initializeSimpleBridge() {
    console.log('🌐 تهيئة الجسر المبسط للموقع...');

    // الحصول على التوكن
    const tokenResult = getTokenUnified();

    console.log('📊 حالة الجسر المبسط:', {
      tokenFound: !!tokenResult,
      source: tokenResult?.source || 'none'
    });

    // إذا كان التوكن موجوداً، الجسر جاهز
    if (tokenResult) {
      window.__viewloopToken = tokenResult.token;
      console.log('🎯 الجسر المبسط جاهز مع توكن صالح');
    }

    // 🔥 خريطة معالجات الرسائل المبسطة لتحسين الأداء
    const simpleMessageHandlers = {
      PING: (request, sender, sendResponse) => {
        sendResponse({
          type: 'PONG',
          status: 'ready',
          bridge: 'simple',
          timestamp: Date.now(),
          hasToken: !!tokenResult
        });
        return true;
      },

      REQUEST_AUTH_TOKEN: (request, sender, sendResponse) => {
        const token = tokenResult?.token || null;
        const response = {
          success: !!token,
          timestamp: Date.now(),
          source: 'simple_bridge',
          bridge: 'simple'
        };

        if (token) {
          response.authToken = token;
          response.tokenPreview = token.substring(0, 30) + '...';
          response.tokenLength = token.length;
        } else {
          response.error = 'NO_TOKEN';
          response.message = 'No token available in simple bridge';
        }

        sendResponse(response);
        return true;
      },

      GET_FRESH_FIREBASE_TOKEN: (request, sender, sendResponse) => {
        // نفس منطق REQUEST_AUTH_TOKEN للتوافق
        const token = tokenResult?.token || null;
        const response = {
          success: !!token,
          timestamp: Date.now(),
          source: 'simple_bridge',
          bridge: 'simple'
        };

        if (token) {
          response.authToken = token;
          response.tokenPreview = token.substring(0, 30) + '...';
          response.tokenLength = token.length;
        } else {
          response.error = 'NO_TOKEN';
          response.message = 'No token available in simple bridge';
        }

        sendResponse(response);
        return true;
      }
    };

    // معالجة رسائل الامتداد المبسطة - محسّن للأداء
    if (isChromeExtension) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('📩 رسالة للجسر المبسط:', request.type);

        const handler = simpleMessageHandlers[request.type];
        if (handler) {
          return handler(request, sender, sendResponse);
        }

        // نوع غير معروف
        sendResponse({
          success: false,
          error: 'UNKNOWN_TYPE',
          receivedType: request.type,
          bridge: 'simple'
        });
        return true;
      });

      console.log('✅ معالجات الرسائل للجسر المبسط جاهزة');
    }
  }

  // ===================== الجسر المتقدم (للامتداد) =====================
  function initializeAdvancedBridge() {
    console.log('🔐 تهيئة الجسر المتقدم للامتداد...');

    // دالة البحث عن التوكن المتقدمة
    function findAuthTokenAdvanced() {
      console.log('🔍 البحث المتقدم عن التوكن...');

      return findAuthTokenSmart();
    }

    // 🔥 خريطة معالجات الرسائل المتقدمة لتحسين الأداء
    const advancedMessageHandlers = {
      PING: (request, sender, sendResponse) => {
        const tokenInfo = findAuthTokenAdvanced();
        sendResponse({
          type: 'PONG',
          status: 'ready',
          version: TOKEN_CONFIG.VERSION,
          timestamp: Date.now(),
          hasToken: tokenInfo.success,
          source: tokenInfo.source,
          bridge: 'advanced'
        });
        return true;
      },

      REQUEST_AUTH_TOKEN: async (request, sender, sendResponse) => {
        console.log('🔐 معالجة طلب التوكن المتقدم...');

        const tokenInfo = findAuthTokenAdvanced();
        const response = {
          success: tokenInfo.success,
          timestamp: Date.now(),
          bridge: TOKEN_CONFIG.VERSION
        };

        if (tokenInfo.success) {
          if (tokenInfo.type === 'firebase_legacy' && tokenInfo.user && !tokenInfo.token) {
            // الحصول على التوكن من Firebase
            try {
              const token = await tokenInfo.user.getIdToken();
              response.success = true;
              response.authToken = token;
              response.source = 'firebase_direct';
              response.tokenPreview = token.substring(0, 30) + '...';
            } catch (error) {
              response.error = 'FIREBASE_TOKEN_ERROR';
              response.message = error.message;
            }
          } else if (tokenInfo.token) {
            response.success = true;
            response.authToken = tokenInfo.token;
            response.source = tokenInfo.source;
            response.tokenPreview = tokenInfo.token.substring(0, 30) + '...';
            response.tokenLength = tokenInfo.token.length;

            // تحليل التوكن
            try {
              const payload = JSON.parse(atob(tokenInfo.token.split('.')[1]));
              response.tokenInfo = {
                user: payload.sub || payload.user_id,
                expires: new Date(payload.exp * 1000).toISOString(),
                expiresIn: Math.floor((payload.exp * 1000 - Date.now()) / 1000) + 's'
              };
            } catch (e) {}
          }
        } else {
          response.error = 'TOKEN_NOT_FOUND';
          response.message = 'No authentication token found';
        }

        // التحقق من السر الديناميكي
        if (request.secret) {
          const isValidSecret = await validateDynamicSecret(request.secret, request.timestamp || Date.now());
          if (!isValidSecret) {
            response.success = false;
            response.error = 'INVALID_SECRET';
            response.secretValidation = 'FAILED';
          } else {
            response.secretValidation = 'SUCCESS';
          }
        } else {
          // إذا لم يتم تقديم سر، فشل الطلب
          response.success = false;
          response.error = 'MISSING_SECRET';
          response.secretValidation = 'MISSING';
        }

        sendResponse(response);
        return true;
      },

      GET_FRESH_FIREBASE_TOKEN: (request, sender, sendResponse) => {
        const response = {
          success: false,
          timestamp: Date.now(),
          bridge: TOKEN_CONFIG.VERSION
        };

        const tokenInfo = findAuthTokenAdvanced();

        if (tokenInfo.success && tokenInfo.type === 'firebase_legacy' && tokenInfo.user) {
          tokenInfo.user.getIdToken(request.forceRefresh || false)
            .then(token => {
              response.success = true;
              response.authToken = token;
              response.source = 'firebase_fresh';
              response.tokenPreview = token.substring(0, 30) + '...';
              response.isFresh = true;
              sendResponse(response);
            })
            .catch(error => {
              response.error = 'FIREBASE_ERROR';
              response.message = error.message;
              sendResponse(response);
            });
        } else {
          response.error = 'NO_FIREBASE_USER';
          response.message = 'Firebase not available or no user logged in';
          sendResponse(response);
        }

        return true;
      },

      VALIDATE_CURRENT_TOKEN: (request, sender, sendResponse) => {
        console.log('✅ التحقق من صحة التوكن الحالي...');

        const tokenInfo = findAuthTokenAdvanced();
        const validation = {
          isValid: tokenInfo.success,
          timestamp: Date.now(),
          tokenInfo: {
            source: tokenInfo.source,
            type: tokenInfo.type,
            hasToken: !!tokenInfo.token
          }
        };

        if (tokenInfo.token) {
          try {
            const payload = JSON.parse(atob(tokenInfo.token.split('.')[1]));
            validation.tokenDetails = {
              expires: new Date(payload.exp * 1000).toISOString(),
              expiresIn: Math.floor((payload.exp * 1000 - Date.now()) / 1000) + 's',
              user: payload.sub || payload.user_id || payload.email
            };
          } catch (e) {
            validation.parseError = e.message;
          }
        }

        sendResponse(validation);
        return true;
      },

      GET_TOKEN_INFO: (request, sender, sendResponse) => {
        console.log('📊 طلب معلومات التوكن...');

        const allTokens = {};
        const tokenKeys = [
          TOKEN_CONFIG.PRIMARY_KEY,
          ...TOKEN_CONFIG.FALLBACK_KEYS
        ];

        // جمع معلومات عن جميع التوكنات
        tokenKeys.forEach(key => {
          const token = localStorage.getItem(key);
          if (token) {
            allTokens[key] = {
              exists: true,
              length: token.length,
              isJWT: token.includes('.') && token.split('.').length === 3,
              preview: token.substring(0, 20) + '...'
            };

            if (token.includes('.')) {
              try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                allTokens[key].expires = payload.exp ?
                  new Date(payload.exp * 1000).toISOString() : 'no_exp';
              } catch (e) {}
            }
          } else {
            allTokens[key] = { exists: false };
          }
        });

        sendResponse({
          success: true,
          timestamp: Date.now(),
          tokens: allTokens,
          firebaseStatus: window.firebase ? {
            available: true,
            type: window.firebase.__bridgeInitialized ? 'REAL' :
                  window.firebase.__isPlaceholder ? 'PLACEHOLDER' : 'UNKNOWN'
          } : { available: false }
        });
        return true;
      },

      STORE_AUTH_TOKEN: (request, sender, sendResponse) => {
        if (request.token) {
          localStorage.setItem('userAuthToken', request.token);
          console.log('💾 تم تخزين التوكن الجديد');
          sendResponse({ success: true, stored: true, bridge: TOKEN_CONFIG.VERSION });
        } else {
          sendResponse({ success: false, error: 'NO_TOKEN_PROVIDED', bridge: TOKEN_CONFIG.VERSION });
        }
        return true;
      }
    };

    // معالجة رسائل الامتداد المتقدمة - محسّن للأداء
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('� رسالة للجسر المتقدم:', request.type, 'من:', sender.id);

      const handler = advancedMessageHandlers[request.type];
      if (handler) {
        return handler(request, sender, sendResponse);
      }

      // نوع غير معروف
      console.warn('⚠️ نوع رسالة غير معروف:', request.type);
      sendResponse({
        success: false,
        error: 'UNKNOWN_MESSAGE_TYPE',
        receivedType: request.type,
        bridge: TOKEN_CONFIG.VERSION
      });
      return true;
    });

    console.log('✅ معالجات الرسائل للجسر المتقدم جاهزة');

    // إرسال حدث الجاهزية
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('viewloopAdvancedBridgeReady'));
      console.log('📢 الجسر المتقدم جاهز');
    }, 100);
  }

  // ===================== التحكم الرئيسي =====================
  function initializeUnifiedBridge() {
    console.log('🎯 بدء تهيئة الجسر الموحد...');

    // تحديد نوع الجسر حسب البيئة
    if (isChromeExtension && !isInIframe) {
      // امتداد Chrome - استخدم الجسر المتقدم
      console.log('🔧 امتداد Chrome مكتشف - تهيئة الجسر المتقدم');
      initializeAdvancedBridge();
    } else if (!isChromeExtension || isInIframe) {
      // موقع ويب أو iframe - استخدم الجسر المبسط
      console.log('🌐 موقع ويب مكتشف - تهيئة الجسر المبسط');
      initializeSimpleBridge();
    } else {
      // حالة غير متوقعة
      console.log('❓ بيئة غير متوقعة - تهيئة الجسر المبسط كبديل');
      initializeSimpleBridge();
    }

    // جعل الدوال متاحة للتصحيح
    window.ViewLoopUnifiedBridge = {
      version: TOKEN_CONFIG.VERSION,
      getToken: getTokenUnified,
      sendMessage: sendMessageUnified,
      findToken: findAuthTokenSmart,
      validateToken: isValidJWT,
      debug: function() {
        return {
          isChromeExtension: isChromeExtension,
          isInIframe: isInIframe,
          isYouTube: isYouTube,
          tokenInfo: getTokenUnified(),
          firebaseAvailable: !!window.firebase,
          firebaseType: window.firebase ?
            (window.firebase.__bridgeInitialized ? 'REAL' :
             window.firebase.__isPlaceholder ? 'PLACEHOLDER' : 'UNKNOWN') : 'NONE'
        };
      }
    };

    console.log('✅ الجسر الموحد جاهز للعمل!');
  }

  // ===================== بدء التشغيل =====================
  // تأخير بسيط للتأكد من تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initializeUnifiedBridge, 300);
    });
  } else {
    setTimeout(initializeUnifiedBridge, 300);
  }

})();
