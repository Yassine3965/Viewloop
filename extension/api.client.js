// ==========================
// SECURE API CLIENT - للتواصل الآمن مع الخادم
// ==========================

// استخدام التكوين العالمي (لا نعيد تعريفه هنا لتجنب التعارض)
const API_BASE_URL = globalThis.ViewLoopConfig?.API_BASE_URL;

// Stable JSON stringify to ensure consistent key ordering for signatures
function stableStringify(obj) {
    return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {})
    );
}

class SecureAPIClient {
    static sessionTokens = new Map(); // sessionId -> token
    static completedSessions = new Set(); // sessionId -> completed flag
    static completedSessionTimestamps = new Map(); // sessionId -> completion timestamp
    static async makeRequest(endpoint, data, options = {}) {
        const url = API_BASE_URL + endpoint;

        // إنشاء التوقيع
        let signature = await this.generateSignature(data);

        // Override signature for start-session since no sessionToken exists yet
        if (endpoint === globalThis.ViewLoopConfig?.ENDPOINTS?.START_SESSION) {
            signature = 'INIT';
            console.log('[API] تعيين توقيع INIT لـ start-session');
        }

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-signature': signature,
                'x-extension-version': '1.0.1',
                'x-client-type': 'extension'
            },
            body: JSON.stringify(data)
        };

        console.log(`🌐 [API] إرسال طلب إلى ${endpoint}`, data);

        try {
            const response = await fetch(url, requestOptions);
            const result = await response.json();

            if (!response.ok) {
                console.error(`❌ [API] فشل الطلب: ${response.status}`, result);
                return { success: false, error: result.error || 'HTTP_ERROR', status: response.status };
            }

            console.log(`✅ [API] نجح الطلب: ${endpoint}`, result);
            return { success: true, result: result };

        } catch (error) {
            console.error(`❌ [API] خطأ في الشبكة:`, error);
            return { success: false, error: 'NETWORK_ERROR', details: error.message };
        }
    }

    static async generateSignature(data) {
        const sessionId = data.sessionId;
        const sessionToken = this.sessionTokens.get(sessionId);

        if (!sessionToken) {
            console.warn(`⚠️ [SECURITY] NO_SESSION: Attempted request without session token for sessionId: ${sessionId}`);
            return 'NO_SESSION';
        }

        // Check if session is already completed
        if (this.completedSessions.has(sessionId)) {
            console.warn(`⚠️ [SECURITY] SESSION_COMPLETED: Attempted request on completed session: ${sessionId}`);
            return 'SESSION_COMPLETED';
        }

        // Sign only critical data for specific request types, ALWAYS exclude clientType
        // Include timestamp for replay protection in all critical requests
        const ts = Math.floor(Date.now() / 1000); // Unix timestamp in seconds for replay protection
        let signData;
        if (data.__type === 'calculate') {
            // This is calculate-points request
            signData = {
                sessionId: data.sessionId,
                videoId: data.videoId,
                ts: ts
            };
        } else if (data.sessionId && 'videoTime' in data && 'isPlaying' in data) {
            // This is heartbeat request - include timestamp for replay protection
            // Include validity fields in signature to ensure server only uses signed data for points calculation
            signData = {
                sessionId: data.sessionId,
                videoTime: data.videoTime,
                isPlaying: data.isPlaying,
                tabActive: data.tabActive,
                windowFocused: data.windowFocused,
                mouseActive: data.mouseActive,
                lastMouseMove: data.lastMouseMove,
                ts: ts
            };
        } else if (data.videoId && data.timestamp && !data.sessionId) {
            // This is start-session request
            signData = {
                videoId: data.videoId,
                timestamp: data.timestamp,
                ts: ts
            };
        } else {
            // Other requests - sign data excluding clientType, include ts for replay protection
            signData = { ...data, ts: ts };
            delete signData.clientType;
        }

        const dataString = stableStringify(signData);
        const combined = dataString + sessionToken;

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(combined);

        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return signature;
    }

    static async startSession(videoId, userId = null, customSessionId = null) {
        // Cleanup old completed sessions to prevent memory leaks
        if (this.completedSessions.size > 50) {
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds
            for (const [sessionId, timestamp] of this.completedSessionTimestamps) {
                if (timestamp < oneHourAgo) {
                    this.completedSessions.delete(sessionId);
                    this.completedSessionTimestamps.delete(sessionId);
                    console.log(`🧹 [CLEANUP] Removed old completed session: ${sessionId}`);
                }
            }
        }

        const data = {
            videoId: videoId,
            userId: userId || 'anonymous',
            sessionId: customSessionId,
            timestamp: Date.now(),
            clientType: 'extension'
        };

        const result = await this.makeRequest(globalThis.ViewLoopConfig?.ENDPOINTS?.START_SESSION, data);
        if (result.success && result.result.sessionToken) {
            // Store the session token
            this.sessionTokens.set(result.result.sessionId, result.result.sessionToken);
        }
        return result;
    }

    static async sendHeartbeat(sessionId, heartbeatData) {
        const data = {
            sessionId: sessionId,
            ...heartbeatData,
            clientType: 'extension'
        };

        return await this.makeRequest(globalThis.ViewLoopConfig?.ENDPOINTS?.HEARTBEAT, data);
    }

    static async sendFinalCalculation(sessionId, sessionData, points) {
        const data = {
            sessionId: sessionId,
            videoId: sessionData?.videoId, // For signature
            sessionData: sessionData,
            points: points,
            clientType: 'extension',
            __type: 'calculate' // Explicit request type for signing
        };

        const result = await this.makeRequest(globalThis.ViewLoopConfig?.ENDPOINTS?.CALCULATE_POINTS, data);

        // Clean up session token after completion and mark as completed
        if (result.success) {
            this.completedSessions.add(sessionId);
            this.completedSessionTimestamps.set(sessionId, Date.now());
            this.sessionTokens.delete(sessionId);
        }

        return result;
    }

    static async validateVideo(videoId) {
        const data = {
            videoId: videoId,
            clientType: 'extension'
        };

        return await this.makeRequest(globalThis.ViewLoopConfig?.ENDPOINTS?.VALIDATE_VIDEO, data);
    }

    static async checkHealth() {
        return await this.makeRequest(globalThis.ViewLoopConfig?.ENDPOINTS?.HEALTH, {
            timestamp: Date.now(),
            clientType: 'extension'
        });
    }
}

// تصدير للاستخدام في الوحدات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecureAPIClient };
} else {
    globalThis.SecureAPIClient = SecureAPIClient;
}
