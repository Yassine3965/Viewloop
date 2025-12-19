// ==========================
// YOUTUBE API VALIDATION
// ==========================
class YouTubeValidator {
    static API_KEY = globalThis.ViewLoopConfig?.API_KEY; // From secure config

    static async validateVideo(videoId) {
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${this.API_KEY}&part=snippet,status,statistics,contentDetails`);

            if (!response.ok) {
                console.log(`❌ [YouTubeAPI] API Error: ${response.status}`);
                return { valid: false, reason: 'API_ERROR' };
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                console.log(`❌ [YouTubeAPI] Video not found: ${videoId}`);
                return { valid: false, reason: 'VIDEO_NOT_FOUND' };
            }

            const video = data.items[0];

            // التحقق من حالة الفيديو
            if (video.status.privacyStatus !== 'public') {
                console.log(`❌ [YouTubeAPI] Video is private: ${videoId}`);
                return { valid: false, reason: 'VIDEO_PRIVATE' };
            }

            if (video.status.uploadStatus !== 'processed') {
                console.log(`❌ [YouTubeAPI] Video not processed: ${videoId}`);
                return { valid: false, reason: 'VIDEO_PROCESSING' };
            }

            // التحقق من وجود إعلانات محتملة (فيديوهات قصيرة جداً أو طويلة جداً)
            const duration = this.parseDuration(video.contentDetails?.duration);
            if (duration < 30 || duration > 7200) { // أقل من 30 ثانية أو أكثر من 2 ساعات
                console.log(`⚠️ [YouTubeAPI] Suspicious duration: ${duration}s for video ${videoId}`);
            }

            console.log(`✅ [YouTubeAPI] Video validated: ${video.snippet.title} (${duration}s)`);

            return {
                valid: true,
                title: video.snippet.title,
                duration: duration,
                channelId: video.snippet.channelId,
                channelTitle: video.snippet.channelTitle,
                viewCount: parseInt(video.statistics.viewCount || 0),
                likeCount: parseInt(video.statistics.likeCount || 0),
                publishedAt: video.snippet.publishedAt
            };

        } catch (error) {
            console.error(`❌ [YouTubeAPI] Network error:`, error);
            return { valid: false, reason: 'NETWORK_ERROR' };
        }
    }

    static parseDuration(duration) {
        if (!duration) return 0;

        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return 0;

        const hours = parseInt((match[1] || '').replace('H', '')) || 0;
        const minutes = parseInt((match[2] || '').replace('M', '')) || 0;
        const seconds = parseInt((match[3] || '').replace('S', '')) || 0;

        return hours * 3600 + minutes * 60 + seconds;
    }

    // كشف الإعلانات بناءً على نمط المشاهدة
    static detectAds(heartbeats) {
        if (!heartbeats || heartbeats.length < 2) return { hasAds: false, adSeconds: 0 };

        let adSeconds = 0;
        let lastTime = heartbeats[0].videoTime;

        for (let i = 1; i < heartbeats.length; i++) {
            const current = heartbeats[i];
            const timeDiff = current.videoTime - lastTime;

            // كشف فجوات زمنية كبيرة (إعلانات)
            if (timeDiff > 15 && current.videoPlaying) { // فجوة أكبر من 15 ثانية
                const gapDuration = Math.min(timeDiff - 5, 60); // حد أقصى دقيقة واحدة للإعلان
                adSeconds += gapDuration;
                console.log(`📺 [AdDetection] Ad detected: ${gapDuration}s gap at ${current.videoTime}s`);
            }

            lastTime = current.videoTime;
        }

        return {
            hasAds: adSeconds > 0,
            adSeconds: Math.floor(adSeconds),
            adCount: Math.ceil(adSeconds / 30) // تقدير عدد الإعلانات
        };
    }
}

// ==========================
// SECURE VALIDATION UTILITIES
// ==========================
class SecureValidators {
    static validateHeartbeatData(data) {
        const required = ['sessionId', 'videoId', 'timestamp', 'videoTime', 'isPlaying'];

        for (const field of required) {
            if (!(field in data)) {
                return { valid: false, reason: `MISSING_${field.toUpperCase()}` };
            }
        }

        // التحقق من أنواع البيانات
        if (typeof data.videoTime !== 'number' || data.videoTime < 0) {
            return { valid: false, reason: 'INVALID_VIDEO_TIME' };
        }

        if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
            return { valid: false, reason: 'INVALID_TIMESTAMP' };
        }

        return { valid: true };
    }

    static validateSessionId(sessionId) {
        if (!sessionId || typeof sessionId !== 'string') {
            return { valid: false, reason: 'INVALID_SESSION_ID' };
        }

        // يجب أن يكون sessionId بتنسيق UUID أو على الأقل سلسلة طويلة بما يكفي
        if (sessionId.length < 10) {
            return { valid: false, reason: 'SESSION_ID_TOO_SHORT' };
        }

        return { valid: true };
    }

    static validateVideoId(videoId) {
        if (!videoId || typeof videoId !== 'string') {
            return { valid: false, reason: 'INVALID_VIDEO_ID' };
        }

        // فحص تنسيق YouTube video ID (11 حرف)
        if (videoId.length !== 11) {
            return { valid: false, reason: 'INVALID_VIDEO_ID_LENGTH' };
        }

        // يمكن إضافة المزيد من التحققات هنا
        return { valid: true };
    }
}

// تصدير للاستخدام في الوحدات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YouTubeValidator, SecureValidators };
} else {
    globalThis.YouTubeValidator = YouTubeValidator;
    globalThis.SecureValidators = SecureValidators;
}
