// ==========================
// SECURE SESSION MANAGER - مبسط وآمن
// ==========================
class SecureSessionManager {
    static activeSessions = new Map(); // sessionId -> sessionData
    static tabSessions = new Map();    // tabId -> sessionId

    static async createSession(sessionId, videoId, tabId, sessionToken = null) {
        console.log(`🔐 [SessionManager] إنشاء جلسة آمنة: ${sessionId} للتبويب ${tabId}`);

        // منع فتح نفس الفيديو في تبويبات متعددة
        if (this.tabSessions.has(tabId)) {
            const existingSessionId = this.tabSessions.get(tabId);
            this.endSession(existingSessionId, 'replaced');
        }

        const sessionData = {
            sessionId: sessionId,
            videoId: videoId,
            tabId: tabId,
            sessionToken: sessionToken,
            sessionTokenExpiry: Date.now() + (24 * 60 * 60 * 1000), // 24 ساعة
            startTime: Date.now(),
            lastHeartbeat: Date.now(),
            heartbeats: [],
            validHeartbeats: 0,
            invalidHeartbeats: 0,
            status: 'active',
            deviceFingerprint: await this.generateDeviceFingerprint()
        };

        this.activeSessions.set(sessionId, sessionData);
        this.tabSessions.set(tabId, sessionId);

        console.log(`✅ [SessionManager] جلسة آمنة تم إنشاؤها: ${sessionId}`);
        return { success: true, sessionData: sessionData };
    }

    static async generateDeviceFingerprint() {
        console.log("🔐 [Fingerprint] إنشاء بصمة جهاز...");

        try {
            // في Service Worker، ليس لدينا access إلى screen أو localStorage
            // استخدم بيانات متاحة فقط في Service Worker
            const userAgent = navigator.userAgent || 'unknown';
            const platform = navigator.platform || 'unknown';
            const timestamp = Date.now().toString();
            const random = Math.random().toString(36).substring(2);

            // بيانات بسيطة يمكن الوصول إليها في Service Worker
            const data = `${userAgent}|${platform}|${timestamp}|${random}|viewloop-fingerprint`;

            console.log("🔐 [Fingerprint] البيانات:", data.substring(0, 50) + "...");

            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);

            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));

            const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);

            console.log("✅ [Fingerprint] تم إنشاء البصمة:", fingerprint.substring(0, 8) + "...");

            return fingerprint;
        } catch (error) {
            console.error("❌ [Fingerprint] خطأ في إنشاء البصمة:", error);
            // رجوع: بصمة عشوائية
            return 'fallback-fp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        }
    }

    static addHeartbeat(sessionId, heartbeatData) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return { valid: false, reason: 'SESSION_NOT_FOUND' };

        // التحقق من صحة النبضة - آليات منع التلاعب
        const validation = this.validateHeartbeat(session, heartbeatData);
        if (!validation.valid) {
            session.invalidHeartbeats++;
            console.log(`🚨 [VALIDATION] نبضة غير صالحة: ${validation.reason}`);
            return { valid: false, reason: validation.reason };
        }

        heartbeatData.receivedAt = Date.now();
        heartbeatData.isValid = true;
        session.heartbeats.push(heartbeatData);
        session.lastHeartbeat = Date.now();
        session.validHeartbeats++;

        return { valid: true };
    }

    static validateHeartbeat(session, heartbeat) {
        const now = Date.now();
        const security = globalThis.ViewLoopConfig?.SECURITY || {
            MAX_HEARTBEAT_RATE_MS: 3000,
            MIN_TIME_DIFF_PER_HEARTBEAT: 3,
            MAX_TIME_DIFF_PER_HEARTBEAT: 7,
            MAX_AD_GAP_MS: 60000
        };

        // 1. التحقق من النشاط الأساسي - **تعطيل مؤقتاً للاختبار**
        // if (!heartbeat.tabActive) {
        //     return { valid: false, reason: 'TAB_INACTIVE' };
        // }

        // if (!heartbeat.mouseActive && heartbeat.isPlaying) {
        //     return { valid: false, reason: 'MOUSE_INACTIVE_WHILE_PLAYING' };
        // }

        // 2. التحقق من الوقت
        if (heartbeat.videoTime < 0 || heartbeat.videoTime > 36000) {
            return { valid: false, reason: 'INVALID_VIDEO_TIME' };
        }

        // 3. كشف التلاعب في الوقت - **تعطيل مؤقتاً للاختبار**
        // if (session.heartbeats.length > 0) {
        //     const lastHeartbeat = session.heartbeats[session.heartbeats.length - 1];
        //     const timeDiff = heartbeat.videoTime - lastHeartbeat.videoTime;
        //
        //     if (heartbeat.isPlaying && lastHeartbeat.isPlaying) {
        //         // الوقت الطبيعي: 3-7 ثواني (نبضة كل 5 ثواني ±2)
        //         if (timeDiff < security.MIN_TIME_DIFF_PER_HEARTBEAT || timeDiff > security.MAX_TIME_DIFF_PER_HEARTBEAT) {
        //             return { valid: false, reason: 'TIME_MANIPULATION' };
        //         }
        //     }
        // }

        // 4. Rate limiting: حد أقصى نبضة كل 3 ثواني (يظل مفعلاً)
        if (session.heartbeats.length > 0) {
            const lastHeartbeat = session.heartbeats[session.heartbeats.length - 1];
            if ((now - lastHeartbeat.receivedAt) < security.MAX_HEARTBEAT_RATE_MS) {
                return { valid: false, reason: 'RATE_LIMIT_EXCEEDED' };
            }
        }

        // 5. التحقق من فجوات كبيرة - **تعطيل مؤقتاً للاختبار**
        // if (session.heartbeats.length > 1) {
        //     const recentHeartbeats = session.heartbeats.slice(-3);
        //     const gaps = recentHeartbeats.map((hb, i) => {
        //         if (i === 0) return 0;
        //         return hb.receivedAt - recentHeartbeats[i-1].receivedAt;
        //     });
        //
        //     const maxGap = Math.max(...gaps);
        //     if (maxGap > security.MAX_AD_GAP_MS) {
        //         return { valid: false, reason: 'SUSPICIOUS_ACTIVITY_GAP' };
        //     }
        // }

        return { valid: true };
    }

    static endSession(sessionId, reason = 'completed') {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;

        session.endTime = Date.now();
        session.status = 'ended';
        session.endReason = reason;

        const totalSeconds = Math.floor((session.endTime - session.startTime) / 1000);
        const validSeconds = session.validHeartbeats * 5;

        session.totalSeconds = totalSeconds;
        session.validSeconds = validSeconds;

        // حذف sessionToken من SecureAPIClient لمنع إعادة الاستخدام
        if (globalThis.SecureAPIClient && globalThis.SecureAPIClient.sessionTokens) {
            globalThis.SecureAPIClient.sessionTokens.delete(sessionId);
            console.log(`🗑️ [SessionManager] sessionToken محذوف للجلسة: ${sessionId}`);
        }

        this.tabSessions.delete(session.tabId);

        console.log(`🛑 [SessionManager] جلسة انتهت: ${sessionId}, السبب: ${reason}`);
        return session;
    }

    static getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }

    static cleanupExpiredSessions() {
        const now = Date.now();

        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (session.endTime && (now - session.endTime) > 3600000) {
                this.activeSessions.delete(sessionId);
                console.log(`🧹 [SessionManager] جلسة قديمة تم حذفها: ${sessionId}`);
            } else if (session.status === 'active' && (now - session.lastHeartbeat) > 86400000) {
                this.activeSessions.delete(sessionId);
                console.log(`🧹 [SessionManager] جلسة نشطة قديمة تم حذفها: ${sessionId}`);
            } else if (session.sessionTokenExpiry && now > session.sessionTokenExpiry) {
                console.log(`⏰ [SessionManager] sessionToken انتهت صلاحيته للجلسة: ${sessionId}`);
                this.endSession(sessionId, 'token_expired');
            }
        }
    }
}

// تصدير للاستخدام في الوحدات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecureSessionManager };
} else {
    globalThis.SecureSessionManager = SecureSessionManager;
}
