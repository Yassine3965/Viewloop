// Minimal ViewLoop Monitor - REST API Heartbeat System
class ViewLoopMonitor {
    constructor() {
        this.isWatching = false;
        this.sessionId = null;
        this.sessionToken = null;
        this.videoId = null;
        this.video = null;
        this.heartbeatInterval = null;
        this.heartbeatBatch = [];
        this.init();
    }

    init() {
        const findVideo = () => {
            this.video = document.querySelector('video');
            if (this.video) {
                this.video.addEventListener('play', () => this.onPlay());
                this.video.addEventListener('ended', () => this.onEnd());
                this.video.addEventListener('pause', () => this.onPause());
                console.log("✅ [ViewLoop] Monitor Ready");
                if (!this.video.paused) this.onPlay();
            } else {
                setTimeout(findVideo, 1000);
            }
        };
        findVideo();
    }

    getVideoId() {
        return new URLSearchParams(window.location.search).get('v');
    }

    async onPlay() {
        const vid = this.getVideoId();
        if (!vid || (this.isWatching && this.videoId === vid)) {
            // Resume heartbeats if paused
            if (this.isWatching && !this.heartbeatInterval) {
                this.startHeartbeats();
            }
            return;
        }

        console.log("▶️ [ViewLoop] Starting Session...");
        this.isWatching = true;
        this.videoId = vid;

        const res = await chrome.runtime.sendMessage({
            type: 'START_WATCHING',
            videoId: vid
        });

        if (res.success) {
            this.sessionId = res.sessionId;
            this.sessionToken = res.sessionToken;
            console.log("✅ [ViewLoop] Session Active:", this.sessionId);
            this.startHeartbeats();
        } else {
            this.isWatching = false;
            console.warn("❌ [ViewLoop] Session Rejected:", res.error);
        }
    }

    onPause() {
        console.log("⏸️ [ViewLoop] Video Paused");
        this.stopHeartbeats();
    }

    startHeartbeats() {
        if (this.heartbeatInterval) return;

        console.log("💓 [ViewLoop] Starting heartbeats...");

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
            console.log("⏹️ [ViewLoop] Stopped heartbeats");
        }
    }

    async sendHeartbeat() {
        if (!this.isWatching || !this.video) return;

        const heartbeat = {
            sessionId: this.sessionId,
            sessionToken: this.sessionToken,
            videoId: this.videoId,
            timestamp: Date.now(),
            videoTime: Math.floor(this.video.currentTime),
            isPlaying: !this.video.paused,
            isTabActive: !document.hidden,
            isEnded: this.video.ended
        };

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
                console.log(`💓 [ViewLoop] Sent ${batch.length} heartbeats`);
            } else {
                console.warn('⚠️ [ViewLoop] Heartbeat failed:', response?.error);
            }
        } catch (error) {
            console.error('❌ [ViewLoop] Heartbeat error:', error);
        }
    }

    async onEnd() {
        if (!this.isWatching) return;
        console.log("🏁 [ViewLoop] Video Ended");

        this.stopHeartbeats();

        // Flush any remaining heartbeats
        await this.flushHeartbeats();

        // Stop watching
        chrome.runtime.sendMessage({ type: 'STOP_WATCHING', sessionId: this.sessionId });

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
window.addEventListener('yt-navigate-finish', () => {
    if (window.vLoop) window.vLoop.onEnd();
    window.vLoop = new ViewLoopMonitor();
});

// Page unload - flush heartbeats
window.addEventListener('beforeunload', () => {
    if (window.vLoop) {
        window.vLoop.flushHeartbeats();
    }
});

window.vLoop = new ViewLoopMonitor();
