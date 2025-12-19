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
        if (this.isWatching) return;

        const videoId = this.getVideoId();
        if (!videoId) return;

        console.log('▶️ [CONTENT] Starting session for video:', videoId);

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
            }
        } catch (error) {
            console.error('❌ [CONTENT] Error starting session:', error);
        }
    }

    handlePause() {
        if (!this.isWatching) return;

        console.log('⏸️ [CONTENT] Video paused');
        this.stopHeartbeats();

        this.sendToBackground('STOP_WATCHING', {
            sessionId: this.sessionId
        });
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

        this.heartbeatInterval = setInterval(() => {
            if (this.isWatching && this.currentVideo) {
                this.sendHeartbeat();
            }
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
            videoId: this.videoId,
            videoTime: videoTime,
            isPlaying: !this.currentVideo.paused,
            tabActive: !document.hidden,
            windowFocused: document.hasFocus(),
            mouseActive: true,
            lastMouseMove: Date.now(),
            sessionDuration: Math.floor((Date.now() - (this.sessionStartTime || Date.now())) / 1000),
            totalHeartbeats: this.heartbeatCount
        };

        console.log(`💓 [CONTENT] Heartbeat ${this.heartbeatCount} at ${videoTime}s`);

        this.sendToBackground('HEARTBEAT', heartbeat);
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
