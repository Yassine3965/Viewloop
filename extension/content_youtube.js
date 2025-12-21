// Minimal ViewLoop Monitor - Just a State Provider
class ViewLoopMonitor {
    constructor() {
        this.isWatching = false;
        this.sessionId = null;
        this.videoId = null;
        this.video = null;
        this.init();
    }

    init() {
        const findVideo = () => {
            this.video = document.querySelector('video');
            if (this.video) {
                this.video.addEventListener('play', () => this.onPlay());
                this.video.addEventListener('ended', () => this.onEnd());
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
        if (!vid || (this.isWatching && this.videoId === vid)) return;

        console.log("▶️ [ViewLoop] Starting Session...");
        this.isWatching = true;
        this.videoId = vid;

        const res = await chrome.runtime.sendMessage({
            type: 'START_WATCHING',
            videoId: vid
        });

        if (res.success) {
            this.sessionId = res.sessionId;
            console.log("✅ [ViewLoop] Session Active:", this.sessionId);
        } else {
            this.isWatching = false;
            console.warn("❌ [ViewLoop] Session Rejected:", res.error);
        }
    }

    onEnd() {
        if (!this.isWatching) return;
        console.log("🏁 [ViewLoop] Video Ended");
        chrome.runtime.sendMessage({ type: 'STOP_WATCHING', sessionId: this.sessionId });
        this.isWatching = false;
        this.sessionId = null;
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

window.vLoop = new ViewLoopMonitor();
