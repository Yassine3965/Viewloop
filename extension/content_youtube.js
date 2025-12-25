// ViewLoop State Observer - REST API Signal System
class ViewLoopMonitor {
    constructor() {
        this.isWatching = false;
        this.sessionId = null;
        this.sessionToken = null;
        this.videoId = null;
        this.video = null;
        this.heartbeatInterval = null;
        this.heartbeatBatch = [];
        this.isFinalized = false; // 🔧 IMPROVEMENT: Prevent double finalization
        this.init();
    }

    init() {
        const findVideo = () => {
            this.video = document.querySelector('video');
            if (this.video) {
                // 🔧 IMPROVEMENT: Add error handling to prevent crashes
                try {
                    this.video.addEventListener('play', () => this.onPlay());
                    this.video.addEventListener('ended', () => this.onEnd());
                    this.video.addEventListener('pause', () => this.onPause());
                    console.log("[ViewLoop] Monitor ready");
                    if (!this.video.paused) this.onPlay();
                } catch (e) {
                    console.error("[ViewLoop] Listener error:", e);
                }
            } else {
                setTimeout(findVideo, 1000);
            }
        };
        findVideo();

        // 🔧 IMPROVEMENT: Add visibility change listener for accurate tab active state
        document.addEventListener('visibilitychange', () => {
            if (this.isWatching && document.hidden) {
                this.stopHeartbeats();
            } else if (this.isWatching && !document.hidden && !this.video.paused) {
                this.startHeartbeats();
            }
        });
    }

    getVideoId() {
        return new URLSearchParams(window.location.search).get('v');
    }

    async onPlay() {
        const vid = this.getVideoId();
        // 🔧 IMPROVEMENT: Prevent race conditions - check if already starting a session
        // 🔧 IMPROVEMENT: Prevent duplicate sessions for same video
        if (!vid || this.isWatching || (this.videoId === vid && this.sessionId)) {
            // Resume heartbeats if paused and same video with active session
            if (this.isWatching && this.videoId === vid && this.sessionId && !this.heartbeatInterval && !document.hidden) {
                this.startHeartbeats();
            }
            return;
        }

        console.log("[ViewLoop] Starting session...");
        this.isWatching = true;
        this.videoId = vid;

        try {
            const res = await chrome.runtime.sendMessage({
                type: 'START_WATCHING',
                videoId: vid
            });

            if (res.success) {
                this.sessionId = res.sessionId;
                this.sessionToken = res.sessionToken;
                console.log("[ViewLoop] Session active:", this.sessionId);
                this.startHeartbeats();
            } else {
                this.isWatching = false;
                console.warn("[ViewLoop] Session rejected:", res.error);
            }
        } catch (e) {
            this.isWatching = false;
            console.error("[ViewLoop] Session error:", e);
        }
    }

    onPause() {
        console.log("[ViewLoop] Video paused");
        this.stopHeartbeats();
    }

    startHeartbeats() {
        // 🔧 IMPROVEMENT: Prevent starting without valid session or if tab hidden
        if (
            this.heartbeatInterval ||
            !this.sessionId ||
            !this.sessionToken ||
            document.hidden
        ) return;

        console.log("[ViewLoop] Starting signals...");

        // Send heartbeat every 8 seconds
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 8000);

        // Send first heartbeat immediately
        this.sendHeartbeat();
    }

    stopHeartbeats() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log("[ViewLoop] Stopped signals");
        }
    }

    async sendHeartbeat() {
        // 🔧 IMPROVEMENT: Additional video validation to prevent errors
        if (!this.isWatching || !this.video || this.video.readyState < 1) return;

        const heartbeat = {
            sessionId: this.sessionId,
            sessionToken: this.sessionToken,
            videoId: this.videoId,
            timestamp: Date.now(),
            videoTime: Math.floor(this.video.currentTime || 0),
            isPlaying: !this.video.paused,
            isTabActive: !document.hidden,
            isEnded: this.video.ended
        };

        // Check if video ended
        if (this.video.ended) {
            console.log("[ViewLoop] Video ended (detected in signal)");
            await this.onEnd();
            return;
        }

        this.heartbeatBatch.push(heartbeat);

        // Send batch every 3 heartbeats (24 seconds)
        if (this.heartbeatBatch.length >= 3) {
            await this.flushHeartbeats();
        }
    }

    async flushHeartbeats() {
        if (this.heartbeatBatch.length === 0) return;

        const batch = [...this.heartbeatBatch];
        this.heartbeatBatch = [];

        try {
            // Send via background script to avoid CORS
            const response = await chrome.runtime.sendMessage({
                type: 'SEND_HEARTBEATS',
                sessionId: this.sessionId,
                sessionToken: this.sessionToken,
                heartbeats: batch
            });

            if (response && response.success) {
                console.log(`[ViewLoop] Sent ${batch.length} signals`);
            } else {
                console.warn('[ViewLoop] Signal failed:', response?.error);
            }
        } catch (error) {
            console.error('[ViewLoop] Signal error:', error);
        }
    }

    async onEnd() {
        // 🔧 IMPROVEMENT: Prevent double finalization
        if (!this.isWatching || this.isFinalized) return;

        this.isFinalized = true;
        console.log("[ViewLoop] Finalizing session");

        this.stopHeartbeats();

        // Flush any remaining heartbeats
        await this.flushHeartbeats();

        try {
            // Complete session
            await chrome.runtime.sendMessage({
                type: 'COMPLETE_SESSION',
                sessionId: this.sessionId,
                sessionToken: this.sessionToken
            });

            // Stop watching
            chrome.runtime.sendMessage({
                type: 'STOP_WATCHING',
                sessionId: this.sessionId
            });
        } catch (e) {
            console.error("[ViewLoop] Finalization error:", e);
        }

        this.isWatching = false;
        this.sessionId = null;
        this.sessionToken = null;
    }
}

// Global state provider for pulses
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_STATE') {
        const v = document.querySelector('video');
        sendResponse({
            isPlaying: v ? !v.paused : false,
            isTabActive: !document.hidden,
            isEnded: v ? v.ended : false,
            videoTime: v ? Math.floor(v.currentTime) : 0
        });
    }
});

// Navigation support
// 🔧 IMPROVEMENT: Safe navigation handling - finalize current session before creating new monitor
window.addEventListener('yt-navigate-finish', async () => {
    if (window.vLoop) {
        await window.vLoop.onEnd();
    }
    window.vLoop = new ViewLoopMonitor();
});

// Page unload - cleanup
window.addEventListener('beforeunload', () => {
    if (window.vLoop) {
        window.vLoop.stopHeartbeats(); // 🔧 IMPROVEMENT: Stop intervals on page unload
        window.vLoop.flushHeartbeats();
    }
});

window.vLoop = new ViewLoopMonitor();
