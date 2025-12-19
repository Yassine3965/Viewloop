// ==========================
// EMERGENCY HEARTBEAT STORAGE
// ==========================
class EmergencyHeartbeatStorage {
    static STORAGE_KEY = 'viewloop_emergency_heartbeats';
    static MAX_STORAGE_TIME = 24 * 60 * 60 * 1000; // 24 ساعة
    static MAX_HEARTBEATS_PER_SESSION = 100; // حد أقصى 100 نبضة لكل جلسة
    static isRetrying = false;

    static async storeHeartbeat(sessionId, heartbeatData) {
        if (!chrome?.storage?.local) {
            console.warn('[EMERGENCY] chrome.storage غير متوفر');
            return;
        }
        if (!globalThis.SecureAPIClient) {
            console.warn('[EMERGENCY] SecureAPIClient غير متوفر');
            return;
        }
        if (!globalThis.SecureSessionManager) {
            console.warn('[EMERGENCY] SecureSessionManager غير متوفر');
            return;
        }
        try {
            const stored = await this.getStoredHeartbeats();
            const sessionKey = `session_${sessionId}`;

            if (!stored[sessionKey]) {
                const sessionToken = SecureAPIClient.sessionTokens.get(sessionId) || SecureSessionManager.getSession(sessionId)?.sessionToken;
                stored[sessionKey] = {
                    heartbeats: [],
                    createdAt: Date.now(),
                    videoId: heartbeatData.videoId,
                    sessionStartTime: heartbeatData.sessionStartTime,
                    sessionToken: sessionToken
                };
            }

            // إضافة النبضة
            const emergencyHeartbeat = {
                ...heartbeatData,
                storedAt: Date.now(),
                retryCount: 0
            };

            stored[sessionKey].heartbeats.push(emergencyHeartbeat);

            // الحد من عدد النبضات لكل جلسة
            if (stored[sessionKey].heartbeats.length > this.MAX_HEARTBEATS_PER_SESSION) {
                stored[sessionKey].heartbeats = stored[sessionKey].heartbeats.slice(-this.MAX_HEARTBEATS_PER_SESSION);
            }

            // حفظ في chrome.storage.local
            await chrome.storage.local.set({ [this.STORAGE_KEY]: stored });

            console.log(`📦 [EMERGENCY] نبضة محفوظة محلياً: ${sessionId} - إجمالي: ${stored[sessionKey].heartbeats.length}`);

        } catch (error) {
            console.error('❌ [EMERGENCY] فشل في حفظ النبضة محلياً:', error);
        }
    }

    static async getStoredHeartbeats() {
        if (!chrome?.storage?.local) {
            console.warn('[EMERGENCY] chrome.storage غير متوفر');
            return {};
        }
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            return result[this.STORAGE_KEY] || {};
        } catch (error) {
            console.error('❌ [EMERGENCY] فشل في قراءة النبضات المحفوظة:', error);
            return {};
        }
    }

    static async retryStoredHeartbeats() {
        if (!chrome?.storage?.local) {
            console.warn('[EMERGENCY] chrome.storage غير متوفر');
            return;
        }
        if (!globalThis.SecureAPIClient) {
            console.warn('[EMERGENCY] SecureAPIClient غير متوفر');
            return;
        }
        if (this.isRetrying) return;
        this.isRetrying = true;

        const stored = await this.getStoredHeartbeats();
        const now = Date.now();
        let retryCount = 0;

        for (const sessionKey of Object.keys(stored)) {
            const sessionData = stored[sessionKey];

            // حذف البيانات القديمة جداً
            if (now - sessionData.createdAt > this.MAX_STORAGE_TIME) {
                console.log(`🗑️ [EMERGENCY] حذف بيانات قديمة: ${sessionKey}`);
                delete stored[sessionKey];
                continue;
            }

            const sessionId = sessionKey.replace('session_', '');
            const pendingHeartbeats = sessionData.heartbeats.filter(hb => hb.retryCount < 3);

            if (pendingHeartbeats.length === 0) continue;

            console.log(`🔄 [EMERGENCY] محاولة إعادة إرسال ${pendingHeartbeats.length} نبضة للجلسة ${sessionId}`);

            // إضافة sessionToken مؤقتاً إلى SecureAPIClient لاستخدام generateSignature
            const originalToken = SecureAPIClient.sessionTokens.get(sessionId);
            if (sessionData.sessionToken) {
                SecureAPIClient.sessionTokens.set(sessionId, sessionData.sessionToken);
            }

            for (const heartbeat of pendingHeartbeats) {
                try {
                    // إرسال النبضة باستخدام SecureAPIClient.sendHeartbeat
                    const enrichedData = {
                        sessionId: sessionId,
                        videoId: sessionData.videoId,
                        timestamp: heartbeat.timestamp,
                        videoTime: heartbeat.videoTime,
                        isPlaying: heartbeat.isPlaying,
                        tabActive: heartbeat.tabActive,
                        windowFocused: heartbeat.windowFocused,
                        mouseActive: heartbeat.mouseActive,
                        lastMouseMove: heartbeat.lastMouseMove,
                        sessionDuration: heartbeat.sessionDuration,
                        totalHeartbeats: heartbeat.totalHeartbeats,
                        sessionStartTime: sessionData.sessionStartTime
                    };

                    const result = await SecureAPIClient.sendHeartbeat(sessionId, enrichedData);

                    if (result.success) {
                        // نجح - حذف النبضة من التخزين
                        sessionData.heartbeats = sessionData.heartbeats.filter(hb => hb !== heartbeat);
                        retryCount++;
                        console.log(`✅ [EMERGENCY] نبضة أعيد إرسالها بنجاح: ${sessionId}`);
                    } else {
                        // فشل - زيادة عدد المحاولات
                        heartbeat.retryCount++;
                        console.log(`❌ [EMERGENCY] فشل إعادة الإرسال: ${sessionId} - محاولة ${heartbeat.retryCount}/3`);
                    }

                } catch (error) {
                    heartbeat.retryCount++;
                    console.log(`❌ [EMERGENCY] خطأ في إعادة الإرسال: ${sessionId} - ${error.message}`);
                }
            }

            // استعادة الـ token الأصلي أو حذف المؤقت
            if (sessionData.sessionToken) {
                if (originalToken) {
                    SecureAPIClient.sessionTokens.set(sessionId, originalToken);
                } else {
                    SecureAPIClient.sessionTokens.delete(sessionId);
                }
            }

            // حذف الجلسة إذا تم إرسال جميع النبضات أو تجاوزت المحاولات
            if (sessionData.heartbeats.length === 0 ||
                sessionData.heartbeats.every(hb => hb.retryCount >= 3)) {
                delete stored[sessionKey];
                console.log(`🧹 [EMERGENCY] تم تنظيف جلسة: ${sessionId}`);
            }
        }

        // حفظ التحديثات
        await chrome.storage.local.set({ [this.STORAGE_KEY]: stored });

        if (retryCount > 0) {
            console.log(`📊 [EMERGENCY] تم إعادة إرسال ${retryCount} نبضة`);
        }

        this.isRetrying = false;
    }

    static async getStats() {
        const stored = await this.getStoredHeartbeats();
        const stats = {
            totalSessions: Object.keys(stored).length,
            totalHeartbeats: 0,
            oldestHeartbeat: null,
            newestHeartbeat: null
        };

        for (const sessionKey of Object.keys(stored)) {
            const sessionData = stored[sessionKey];
            stats.totalHeartbeats += sessionData.heartbeats.length;

            for (const hb of sessionData.heartbeats) {
                if (!stats.oldestHeartbeat || hb.storedAt < stats.oldestHeartbeat) {
                    stats.oldestHeartbeat = hb.storedAt;
                }
                if (!stats.newestHeartbeat || hb.storedAt > stats.newestHeartbeat) {
                    stats.newestHeartbeat = hb.storedAt;
                }
            }
        }

        return stats;
    }
}

// تصدير للاستخدام في الوحدات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EmergencyHeartbeatStorage };
} else {
    globalThis.EmergencyHeartbeatStorage = EmergencyHeartbeatStorage;
}
