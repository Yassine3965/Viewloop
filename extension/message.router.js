// ==========================
// SECURE MESSAGE HANDLER — FINAL (SERVER AUTHORITATIVE)
// ==========================

class SecureMessageHandler {

    // ==========================
    // ENTRY POINT
    // ==========================
    static async handleMessage(msg, sender, sendResponse) {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ success: false, error: "NO_TAB_ID" });
            return true;
        }

        const ALLOWED_TYPES = new Set([
            'START_WATCHING',
            'HEARTBEAT',
            'VIDEO_ENDED',
            'VIDEO_PAUSED',
            'VIDEO_RESUMED',
            'TEST_MESSAGE_FLOW'
        ]);

        if (!ALLOWED_TYPES.has(msg.type)) {
            sendResponse({ success: false, error: "FORBIDDEN_MESSAGE_TYPE" });
            return true;
        }

        try {
            switch (msg.type) {

                case 'START_WATCHING':
                    return await this.startWatching(msg, tabId, sendResponse);

                case 'HEARTBEAT':
                    return await this.handleHeartbeat(msg, tabId, sendResponse);

                case 'VIDEO_ENDED':
                    return await this.endSession(msg, tabId, sendResponse);

                case 'VIDEO_PAUSED':
                case 'VIDEO_RESUMED':
                    return this.updatePlaybackState(msg, tabId, sendResponse);

                case 'TEST_MESSAGE_FLOW':
                    sendResponse({ success: true, timestamp: Date.now() });
                    return true;
            }
        } catch (err) {
            console.error("❌ [BG] Handler Error:", err);
            sendResponse({ success: false, error: "INTERNAL_ERROR" });
            return true;
        }
    }

    // ==========================
    // START SESSION (SERVER ONLY)
    // ==========================
    static async startWatching(msg, tabId, sendResponse) {
        const { videoId } = msg;
        if (!videoId) {
            sendResponse({ success: false, error: "MISSING_VIDEO_ID" });
            return true;
        }

        const server = await SecureAPIClient.startSession(videoId);

        if (!server?.success || !server.sessionId) {
            sendResponse({ success: false, error: "SERVER_REJECTED_SESSION" });
            return true;
        }

        const sessionId = server.sessionId;

        const created = SecureSessionManager.createSession(
            sessionId,
            videoId,
            tabId
        );

        if (!created.success) {
            sendResponse({ success: false, error: "LOCAL_SESSION_FAILED" });
            return true;
        }

        chrome.tabs.sendMessage(tabId, {
            type: "SESSION_CONFIRMED",
            sessionId
        }).catch(err => console.warn("Tab message failed:", err?.message));

        sendResponse({
            success: true,
            sessionId
        });

        return true;
    }

    // ==========================
    // HEARTBEAT (NO CREATION)
    // ==========================
    static async handleHeartbeat(msg, tabId, sendResponse) {
        const {
            sessionId,
            videoId,
            videoTime
        } = msg;

        if (!sessionId || !videoId) {
            sendResponse({ success: false, error: "MISSING_SESSION" });
            return true;
        }

        const session = SecureSessionManager.getSession(sessionId);
        if (!session) {
            sendResponse({ success: false, error: "SESSION_NOT_FOUND" });
            return true;
        }

        if (session.tabId !== tabId) {
            sendResponse({ success: false, error: "TAB_MISMATCH" });
            return true;
        }

        if (session.videoId !== videoId) {
            sendResponse({ success: false, error: "VIDEO_MISMATCH" });
            return true;
        }

        if (typeof videoTime !== 'number') {
            sendResponse({ success: false, error: "INVALID_HEARTBEAT" });
            return true;
        }

        // Rate limiting: منع flood attacks
        const now = Date.now();
        if (session.lastHeartbeat && (now - session.lastHeartbeat) < 3000) {
            sendResponse({ success: false, error: "HEARTBEAT_TOO_FAST" });
            return true;
        }

        // استخدام timestamp آمن من الخادم
        const safeTimestamp = now;

        const result = await SecureAPIClient.sendHeartbeat(sessionId, {
            sessionId,
            videoId,
            videoTime,
            isPlaying: session.isPlaying,
            timestamp: safeTimestamp
        });

        // تحديث وقت آخر نبضة
        session.lastHeartbeat = safeTimestamp;

        if (!result.success) {
            EmergencyHeartbeatStorage.storeHeartbeat(sessionId, {
                sessionId,
                videoId,
                videoTime,
                isPlaying: session.isPlaying,
                timestamp: safeTimestamp,
                sessionStartTime: session.startTime
            });
        }

        sendResponse({ success: result.success });
        return true;
    }

    // ==========================
    // END SESSION (SERVER DECIDES)
    // ==========================
    static async endSession(msg, tabId, sendResponse) {
        const { sessionId } = msg;

        const session = SecureSessionManager.getSession(sessionId);
        if (!session || session.tabId !== tabId) {
            sendResponse({ success: false, error: "INVALID_SESSION" });
            return true;
        }

        await SecureAPIClient.endSession(sessionId);
        SecureSessionManager.endSession(sessionId, 'completed');

        sendResponse({ success: true });
        return true;
    }

    // ==========================
    // PAUSE / RESUME (STATE ONLY)
    // ==========================
    static updatePlaybackState(msg, tabId, sendResponse) {
        const { sessionId } = msg;
        const session = SecureSessionManager.getSession(sessionId);

        if (!session || session.tabId !== tabId) {
            sendResponse({ success: false });
            return true;
        }

        session.isPlaying = msg.type === 'VIDEO_RESUMED';
        sendResponse({ success: true });
        return true;
    }
}

// Export
globalThis.SecureMessageHandler = SecureMessageHandler;
