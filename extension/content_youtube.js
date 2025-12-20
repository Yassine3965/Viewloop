// Simple YouTube Monitor for ViewLoop
console.log("🚀 [CONTENT] ViewLoop Monitor loaded");

// Simple monitor class
class SimpleYouTubeMonitor {
    constructor() {
        this.sessionId = null;
        this.videoId = null;
        this.isWatching = false;
        this.heartbeatInterval = null;
        this.currentVideo = null;
        this.heartbeatCount = 0;
        this.metaSent = false; // Track if metadata was sent

        console.log('🎬 [CONTENT] Initializing YouTube monitor');
        this.initialize();
    }

    initialize() {
        // Wait for YouTube to load
        const checkYouTube = () => {
            const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
            const isYouTube = window.location.hostname.includes('youtube.com');

            if (isYouTube && video) {
                console.log('✅ [CONTENT] YouTube ready, setting up monitor');
                this.setupVideoListeners(video);
            } else {
                setTimeout(checkYouTube, 1000);
            }
        };

        setTimeout(checkYouTube, 1000);
    }

    setupVideoListeners(video) {
        if (!video) return;

        this.currentVideo = video;
        console.log('🎯 [CONTENT] Video listeners attached');

        // Send video metadata when loaded
        video.addEventListener('loadedmetadata', () => this.sendVideoMeta(video));

        video.addEventListener('play', () => this.handlePlay());
        video.addEventListener('pause', () => this.handlePause());
        video.addEventListener('ended', () => this.handleEnd());
    }

    getVideoId() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('v');
        } catch (error) {
            return null;
        }
    }

    async handlePlay() {
        const videoId = this.getVideoId();
        if (!videoId) return;

        // If we are already watching/in-session, just ensure heartbeats are running (Resume)
        if (this.isWatching && this.sessionId) {
            console.log('▶️ [CONTENT] Resuming session for video:', videoId);
            this.startHeartbeats();
            return;
        }

        console.log('▶️ [CONTENT] Starting NEW session for video:', videoId);

        this.isWatching = true;
        this.videoId = videoId;
        this.sessionId = 'session_' + Date.now();

        // Start session with background
        try {
            const response = await this.sendToBackground('START_WATCHING', {
                sessionId: this.sessionId,
                videoId: videoId
            });

            if (response.success) {
                console.log('✅ [CONTENT] Session started');
                this.startHeartbeats();
            } else {
                console.error('❌ [CONTENT] Failed to start session:', response);
                this.isWatching = false; // Reset if failed
            }
        } catch (error) {
            console.error('❌ [CONTENT] Error starting session:', error);
            this.isWatching = false;
        }
    }

    handlePause() {
        if (!this.isWatching) return;

        console.log('⏸️ [CONTENT] Video paused (Session kept alive)');
        this.stopHeartbeats();
        // REMOVED: STOP_WATCHING call. We keep the session open.
    }

    handleEnd() {
        if (!this.isWatching) return;

        console.log('🏁 [CONTENT] Video ended');
        this.stopHeartbeats();

        this.sendToBackground('STOP_WATCHING', {
            sessionId: this.sessionId
        });

        this.reset();
    }

    startHeartbeats() {
        if (this.heartbeatInterval) return;

        console.log('💓 [CONTENT] Starting heartbeats');

        // IMMEDIATE HEARTBEAT (Fix for "start from 1st second")
        if (this.isWatching && this.currentVideo) {
            this.sendHeartbeat();
        }

        this.heartbeatInterval = setInterval(() => {
            if (!this.isWatching || !this.currentVideo) {
                this.stopHeartbeats();
                return;
            }

            // 🛡️ SECURITY CHECK: Detect if video ended but event wasn't caught
            if (this.currentVideo.ended) {
                console.warn('⚠️ [CONTENT] Video ended detected via loop (Event missed)');
                this.handleEnd(); // This will stop heartbeats and finalize session
                return;
            }

            // 🛡️ SECURITY CHECK: Detect if video paused but event wasn't caught
            if (this.currentVideo.paused) {
                console.warn('⚠️ [CONTENT] Video paused detected via loop (Event missed)');
                this.handlePause(); // This will stop heartbeats
                return;
            }

            this.sendHeartbeat();
        }, 5000);
    }

    stopHeartbeats() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('🛑 [CONTENT] Heartbeats stopped');
        }
    }

    sendHeartbeat() {
        if (!this.sessionId || !this.currentVideo) return;

        this.heartbeatCount++;
        const videoTime = Math.floor(this.currentVideo.currentTime);

        const heartbeat = {
            sessionId: this.sessionId,
            t: videoTime,                    // current time
            p: !this.currentVideo.paused,    // playing state
            v: document.visibilityState === "visible",  // visibility state
            f: document.hasFocus()           // focus state
        };

        console.log(`💓 [CONTENT] Heartbeat ${this.heartbeatCount}: t=${heartbeat.t}, p=${heartbeat.p}, v=${heartbeat.v}, f=${heartbeat.f}`);

        this.sendToBackground('HEARTBEAT', heartbeat);
    }

    // Send video metadata to server
    sendVideoMeta(video) {
        if (!video || !video.duration || isNaN(video.duration) || this.metaSent) return;

        const videoId = this.getVideoId();
        if (!videoId) return;

        const duration = Math.floor(video.duration);

        // Send metadata to server
        // Send metadata to background to proxy to server
        this.sendToBackground('SEND_VIDEO_META', {
            videoId: videoId,
            duration: duration
        }).then(() => {
            console.log(`📊 [CONTENT] Video metadata queued for sending: ${videoId}`);
            this.metaSent = true;
        }).catch(err => {
            console.error("❌ [CONTENT] Failed to queue metadata:", err);
        });
    }

    sendToBackground(type, data) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type, ...data }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(`❌ [CONTENT] Message error:`, chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    reset() {
        this.isWatching = false;
        this.sessionId = null;
        this.videoId = null;
        this.stopHeartbeats();
        this.heartbeatCount = 0;
        this.metaSent = false; // Reset metadata flag
        console.log('🔄 [CONTENT] Monitor reset');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.youtubeMonitor = new SimpleYouTubeMonitor();
    });
} else {
    window.youtubeMonitor = new SimpleYouTubeMonitor();
}

// Handle page navigation
window.addEventListener('yt-navigate-finish', () => {
    console.log('🔄 [CONTENT] YouTube navigation detected');
    if (window.youtubeMonitor) {
        window.youtubeMonitor.reset();
        setTimeout(() => window.youtubeMonitor.initialize(), 1000);
    }
});

console.log("✅ [CONTENT] ViewLoop Monitor initialized");
