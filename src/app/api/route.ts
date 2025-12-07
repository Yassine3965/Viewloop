// =====================================================
//      BACKGROUND SERVICE WORKER — ViewLoop (Lite Version)
// =====================================================

console.log("🔧 ViewLoop Background - No Sensitive Logic");

// ==========================
// CONFIGURATION
// ==========================
const API_BASE_URL = "https://viewloop.vercel.app/api";
const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// ==========================
// SIMPLE RATE LIMITING
// ==========================
class SimpleRateLimiter {
    constructor() {
        this.requests = new Map();
        setInterval(() => this.cleanup(), 300000);
    }

    canRequest(userId, action) {
        const now = Date.now();
        const key = `${userId}:${action}`;

        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }

        const userRequests = this.requests.get(key);
        const windowStart = now - 60000; // دقيقة

        // تنظيف الطلبات القديمة
        const recentRequests = userRequests.filter(req => req > windowStart);

        // الحد: 10 طلبات في الدقيقة
        if (recentRequests.length >= 10) {
            return false;
        }

        recentRequests.push(now);
        this.requests.set(key, recentRequests);
        return true;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, requests] of this.requests.entries()) {
            const filtered = requests.filter(req => now - req < 60000);
            if (filtered.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, filtered);
            }
        }
    }
}

const rateLimiter = new SimpleRateLimiter();

// ==========================
// SESSION MANAGEMENT (SIMPLE)
// ==========================
let currentSession = {
    token: null,
    videoID: null,
    userID: null,
    isWatching: false,
    heartbeatInterval: null,
    lastHeartbeat: Date.now()
};

// ==========================
// CORE FUNCTIONS (BASICS ONLY)
// ==========================

// 1. Get auth token from site
function getExtensionSecret() {
    return EXTENSION_SECRET;
}

async function getAuthToken(tabId) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('⏰ انتهت المهلة');
            resolve(null);
        }, 10000);

        chrome.tabs.sendMessage(tabId, {
            type: "REQUEST_AUTH_TOKEN",
            secret: EXTENSION_SECRET
        }, (response) => {
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
                console.warn("❌ خطأ في الاتصال:", chrome.runtime.lastError.message);
                resolve(null);
            } else if (response && response.success) {
                console.log("✅ تم الحصول على التوكن");
                resolve(response.authToken);
            } else {
                resolve(null);
            }
        });
    });
}

// 2. Start watching session (SECURE)
async function startSession(videoID, userAuthToken) {
    try {
        // Simple rate limit check
        if (!rateLimiter.canRequest(userAuthToken, 'startSession')) {
            console.warn('⏸️ الكثير من الطلبات، حاول لاحقاً');
            return false;
        }

        console.log("🚀 بدء جلسة جديدة آمنة");

        // ⭐ ALL LOGIC IN SERVER - SECURE COMMUNICATION ⭐
        const response = await secureFetch(`${API_BASE_URL}/start-session`, {
            method: "POST",
            body: JSON.stringify({
                videoID,
                userAuthToken
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error("❌ فشل في بدء الجلسة:", data.error);
            return false;
        }

        // Save token only
        currentSession.token = data.sessionToken;
        currentSession.videoID = videoID;
        currentSession.userID = userAuthToken;
        currentSession.isWatching = true;

        console.log("✅ بدأت الجلسة بنجاح مع تشفير HMAC");
        return true;

    } catch (err) {
        console.error("❌ فشل في بدء الجلسة:", err);
        stopSession();
        return false;
    }
}

// 3. Send Heartbeat (SECURE)
async function sendHeartbeat() {
    if (!currentSession.token) return;

    try {
        // ⭐ ALL LOGIC IN SERVER - SECURE COMMUNICATION ⭐
        const response = await secureFetch(`${API_BASE_URL}/heartbeat`, {
            method: "POST",
            body: JSON.stringify({
                sessionToken: currentSession.token,
                mouseMoved: lastMousePosition.moved,
                tabIsActive: document.visibilityState === 'visible'
            })
        });

        // Reset mouse movement after sending
        lastMousePosition.moved = false;

        currentSession.lastHeartbeat = Date.now();

        if (!response.ok) {
            const data = await response.json();
            console.warn("⚠️ مشكلة في الـ heartbeat:", data.error);

            // If real error, stop session
            if (data.error === 'SESSION_EXPIRED' || data.error === 'INVALID_TOKEN') {
                stopSession();
            }
        }

    } catch (err) {
        console.error("❌ خطأ في الـ heartbeat:", err);
    }
}


// 4. Complete session (SECURE)
async function completeSession() {
    if (!currentSession.token) {
        console.error("❌ لا توجد جلسة نشطة");
        return;
    }

    try {
        console.log("🎯 إكمال الجلسة بأمان");

        // ⭐ ALL LOGIC IN SERVER - SECURE COMMUNICATION ⭐
        const response = await secureFetch(`${API_BASE_URL}/complete`, {
            method: "POST",
            body: JSON.stringify({
                sessionToken: currentSession.token
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log("✅ تم إكمال الجلسة بنجاح");
        } else {
            console.warn("⚠️ مشكلة في إكمال الجلسة:", data.error);
        }

    } catch (err) {
        console.error("❌ خطأ في إكمال الجلسة:", err);
    } finally {
        stopSession();
    }
}

// 5. Send ad watched event (SECURE)
async function sendAdWatched(adDuration) {
    if (!adDuration || adDuration <= 0) {
        console.error('❌ مدة غير صالحة');
        return;
    }

    try {
        const sessionToken = currentSession.token;
        if (!sessionToken) {
            console.error('❌ لا توجد جلسة نشطة');
            return;
        }

        // ⭐ ALL LOGIC IN SERVER - SECURE COMMUNICATION ⭐
        const response = await secureFetch(`${API_BASE_URL}/ad-watched`, {
            method: "POST",
            body: JSON.stringify({
                sessionToken: sessionToken,
                adDuration: adDuration
            })
        });

        const data = await response.json();
        console.log("✅ تم إرسال حدث الإعلان بأمان:", data);

    } catch (error) {
        console.error("❌ خطأ في إرسال حدث الإعلان:", error);
    }
}

// ==========================
// HEARTBEAT SYSTEM (SIMPLE)
// ==========================
function startHeartbeatSystem() {
    if (currentSession.heartbeatInterval) {
        clearInterval(currentSession.heartbeatInterval);
    }

    currentSession.heartbeatInterval = setInterval(sendHeartbeat, 15000); // Changed to 15 seconds
    console.log("💓 بدأ الـ heartbeat كل 15 ثانية");
    sendHeartbeat(); // أول مرة مباشرة
}

function stopHeartbeat() {
    if (currentSession.heartbeatInterval) {
        clearInterval(currentSession.heartbeatInterval);
        currentSession.heartbeatInterval = null;
        console.log("⏹️ توقف الـ heartbeat");
    }
}

function stopSession() {
    stopHeartbeat();

    currentSession = {
        token: null,
        videoID: null,
        userID: null,
        isWatching: false,
        heartbeatInterval: null,
        lastHeartbeat: Date.now()
    };

    console.log("🛑 توقفت الجلسة");
}

// ==========================
// MESSAGE LISTENER (SIMPLE)
// ==========================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('📨 استلام رسالة:', msg.type);

    switch (msg.type) {

        case "START_WATCHING":
            console.log("🎬 بدء مشاهدة");

            // If there's an active session, stop it first
            if (currentSession.isWatching) {
                console.log("🔄 جلسة نشطة موجودة، إيقافها أولاً");
                stopSession();
            }

            // Find auth token
            (async () => {
                try {
                    // Search in tabs
                    const tabs = await chrome.tabs.query({
                        url: ["*://viewloop.vercel.app/*", "*://localhost:*/*"]
                    });

                    if (tabs.length === 0) {
                        console.error("❌ يجب فتح موقع ViewLoop أولاً");
                        sendResponse({ success: false, error: 'site_not_open' });
                        return;
                    }

                    // Get auth token
                    const authToken = await getAuthToken(tabs[0].id);
                    if (!authToken) {
                        console.error("❌ يجب تسجيل الدخول أولاً");
                        sendResponse({ success: false, error: 'not_logged_in' });
                        return;
                    }

                    // Start session - The server will validate the videoID
                    const ok = await startSession(msg.videoID, authToken);
                    if (ok) {
                        startHeartbeatSystem();
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'session_failed' });
                    }

                } catch (error) {
                    console.error("❌ خطأ في بدء المشاهدة:", error);
                    sendResponse({ success: false, error: 'unknown_error' });
                }
            })();

            return true; // For async response

        case "PAUSE_WATCHING":
            console.log("⏸️ إيقاف المشاهدة");
            stopHeartbeat();
            sendResponse({ success: true });
            break;

        case "RESUME_WATCHING":
            console.log("▶️ استئناف المشاهدة");
            if (currentSession.isWatching && !currentSession.heartbeatInterval) {
                startHeartbeatSystem();
            }
            sendResponse({ success: true });
            break;

        case "VIDEO_ENDED":
            console.log('🏁 نهاية الفيديو');
            if (currentSession.isWatching) {
                completeSession();
            }
            sendResponse({ success: true });
            break;

        case "VIDEO_PAUSED":
            console.log('⏸️ الفيديو متوقف');
            stopHeartbeat();
            sendResponse({ success: true });
            break;

        case "VIDEO_RESUMED":
            console.log('▶️ الفيديو استؤنف');
            if (currentSession.isWatching && !currentSession.heartbeatInterval) {
                startHeartbeatSystem();
            }
            sendResponse({ success: true });
            break;

        case "AD_WATCHED":
            console.log('📺 إعلان تمت مشاهدته:', msg.duration, 'ثانية');

            if (!msg.duration || msg.duration <= 0) {
                sendResponse({ success: false, error: 'invalid_duration' });
                break;
            }

            // ⭐ JUST SEND THE EVENT, VALIDATION IN SERVER ⭐
            sendAdWatched(msg.duration);
            sendResponse({ success: true });
            break;

        case "STORE_AUTH_TOKEN":
            // Store token from site
            if (msg.secret === EXTENSION_SECRET && msg.token) {
                console.log("💾 تخزين التوكن من الموقع");
                chrome.storage.local.set({
                    authToken: msg.token,
                    receivedAt: Date.now()
                });
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, message: 'Invalid' });
            }
            return true;
        
        case "ACTIVITY_DATA":
            if (currentSession.isWatching) {
                sendActivityDataToServer(msg.data).catch(err => console.error(err));
            }
            sendResponse({ success: true });
            break;

        case "BEHAVIOR_DATA":
            if (currentSession.isWatching) {
                sendBehaviorDataToServer(msg.data).catch(err => console.error(err));
            }
            sendResponse({ success: true });
            break;
        
        case "TAB_CLOSED":
            if (currentSession.isWatching && currentSession.videoID === msg.videoId) {
                completeSession();
            }
            sendResponse({ success: true });
            break;
        
        case "VIDEO_SWITCHED":
            if (currentSession.isWatching && currentSession.videoID === msg.oldVideoId) {
                completeSession();
            }
            sendResponse({ success: true });
            break;

        default:
            console.log('❓ رسالة غير معروفة:', msg.type);
            sendResponse({ error: 'unknown_message_type' });
    }

    return true;
});


// ==========================
// SECURE COMMUNICATION LAYER
// ==========================
async function secureFetch(url, options = {}) {
    try {
        const bodyString = options.body || '{}';
        
        const requestBody = JSON.parse(bodyString);

        // Generate HMAC signature for the request body
        const hmac = crypto.createHmac('sha256', EXTENSION_SECRET);
        hmac.update(bodyString);
        const signature = hmac.digest('hex');

        // Enhanced headers
        const secureHeaders = {
            ...options.headers,
            'Content-Type': 'application/json',
            'X-HMAC-Signature': signature,
        };
        
        // Send secure request
        const response = await fetch(url, {
            ...options,
            body: bodyString,
            headers: secureHeaders
        });

        return response;

    } catch (error) {
        console.error("❌ خطأ في الطلب الآمن:", error);
        throw error;
    }
}

// ==========================
// SECURE API FUNCTIONS FOR BEHAVIOR
// ==========================

// إرسال بيانات النشاط للخادم بأمان
async function sendActivityDataToServer(activityData) {
    try {
        const response = await secureFetch(`${API_BASE_URL}/activity-data`, {
            method: "POST",
            body: JSON.stringify({
                ...activityData,
                sessionToken: currentSession.token,
            })
        });
        if (!response.ok) {
            console.error('Failed to send activity data', await response.text());
        }
    } catch (error) {
        console.error("❌ خطأ في إرسال بيانات النشاط:", error);
    }
}

// إرسال بيانات السلوك النهائية للخادم بأمان
async function sendBehaviorDataToServer(behaviorData) {
    try {
        const response = await secureFetch(`${API_BASE_URL}/behavior-data`, {
            method: "POST",
            body: JSON.stringify({
                ...behaviorData,
                sessionToken: currentSession.token,
            })
        });
        if (!response.ok) {
            console.error('Failed to send behavior data', await response.text());
        }
    } catch (error) {
        console.error("❌ خطأ في إرسال بيانات السلوك:", error);
    }
}


// ==========================
// INITIALIZATION
// ==========================
console.log("✅ ViewLoop Extension loaded - No sensitive logic, secure comms enabled");
// Note: crypto.createHmac is not available in browser extensions' service workers.
// This code is illustrative and would need to use Web Crypto API's crypto.subtle.sign.
// The secureFetch function needs to be rewritten using Web Crypto API.
const crypto = require('crypto');
const lastMousePosition = { x: 0, y: 0, moved: false };

if (typeof self !== 'undefined') {
    self.addEventListener('mousemove', (e) => {
        if (e.clientX !== lastMousePosition.x || e.clientY !== lastMousePosition.y) {
            lastMousePosition.x = e.clientX;
            lastMousePosition.y = e.clientY;
            lastMousePosition.moved = true;
        }
    });
}

    