// ==========================
// SECURE HEARTBEAT SYSTEM
// ==========================
class SecureHeartbeatSystem {
    static pendingHeartbeats = new Map(); // sessionId -> heartbeats queue

    static async sendHeartbeat(sessionId, heartbeatData) {
        const session = SecureSessionManager.getSession(sessionId);
        if (!session) return { success: false, error: 'SESSION_NOT_FOUND' };

        // إضافة إلى قائمة الانتظار
        if (!this.pendingHeartbeats.has(sessionId)) {
            this.pendingHeartbeats.set(sessionId, []);
        }
        this.pendingHeartbeats.get(sessionId).push(heartbeatData);

        // إرسال دفعة إلى الخادم
        return await this.flushHeartbeats(sessionId);
    }

    static async flushHeartbeats(sessionId) {
        const queue = this.pendingHeartbeats.get(sessionId);
        if (!queue || queue.length === 0) return { success: true };

        const session = SecureSessionManager.getSession(sessionId);
        if (!session) return { success: false, error: 'SESSION_NOT_FOUND' };

        // نقل الـ queue مؤقتًا لمنع التوازي
        const heartbeatsToSend = queue.slice();
        this.pendingHeartbeats.set(sessionId, []);

        try {
            const payload = {
                sessionId: sessionId,
                videoId: session.videoId,
                heartbeats: heartbeatsToSend,
                timestamp: Date.now(),
                clientType: 'extension'
            };

            // توقيع البيانات باستخدام نفس منطق SecureAPIClient
            const signature = await SecureAPIClient.generateSignature(payload);

            const response = await fetch(`${globalThis.ViewLoopConfig?.API_BASE_URL}${globalThis.ViewLoopConfig?.ENDPOINTS?.HEARTBEAT_BATCH}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-signature': signature,
                    'x-extension-version': '1.0.1',
                    'x-client-type': 'extension'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`✅ [Heartbeat] ${heartbeatsToSend.length} نبضات تم إرسالها للجلسة ${sessionId} - نجاح!`);
                return { success: true };
            } else {
                const errorText = await response.text();
                console.error(`❌ [Heartbeat] فشل إرسال النبضات للجلسة ${sessionId}: ${response.status} - ${errorText}`);

                // Fallback: حفظ في Emergency Storage
                await Promise.all(
                    heartbeatsToSend.map(hb => EmergencyHeartbeatStorage.storeHeartbeat(sessionId, hb))
                );
                console.log(`📦 [EMERGENCY] ${heartbeatsToSend.length} نبضات محفوظة محلياً بسبب فشل الإرسال`);

                return { success: false, error: 'SERVER_ERROR', status: response.status, details: errorText, fallback: true };
            }

        } catch (error) {
            console.error(`❌ [Heartbeat] خطأ في إرسال النبضات:`, error);

            // Fallback: حفظ في Emergency Storage
            await Promise.all(
                heartbeatsToSend.map(hb => EmergencyHeartbeatStorage.storeHeartbeat(sessionId, hb))
            );
            console.log(`📦 [EMERGENCY] ${heartbeatsToSend.length} نبضات محفوظة محلياً بسبب خطأ الشبكة`);

            return { success: false, error: 'NETWORK_ERROR', fallback: true };
        }
    }


}

// تصدير للاستخدام في الوحدات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecureHeartbeatSystem };
} else {
    globalThis.SecureHeartbeatSystem = SecureHeartbeatSystem;
}
