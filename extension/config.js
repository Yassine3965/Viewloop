// =====================================================
//      CONFIGURATION FILE - Secure Storage for Secrets
// =====================================================

// IMPORTANT: Replace these with your actual secure values
// For production, these should be stored in chrome.storage.local with encryption
// or retrieved from a secure backend endpoint

// Default configuration (fallback values for development)
const DEFAULT_CONFIG = {
    // API Configuration
    API_BASE_URL: "https://viewloop.vercel.app",

    // API Endpoints
    ENDPOINTS: {
        START_SESSION: '/api/start-session',
        HEARTBEAT: '/api/heartbeat-data',
        HEARTBEAT_BATCH: '/api/heartbeat-batch',
        CALCULATE_POINTS: '/api/calculate-points',
        HEALTH: '/api/health',
        VALIDATE_VIDEO: '/api/check-video'
    },

    // Security Settings
    SECURITY: {
        // Heartbeat validation settings
        MAX_HEARTBEAT_RATE_MS: 3000, // Minimum 3 seconds between heartbeats
        TAB_INACTIVE_TIMEOUT_MS: 30000, // 30 seconds mouse inactivity
        MAX_TIME_DIFF_PER_HEARTBEAT: 7, // Max 7 seconds per 5-second heartbeat
        MIN_TIME_DIFF_PER_HEARTBEAT: 3, // Min 3 seconds per 5-second heartbeat
        MAX_AD_GAP_MS: 60000, // 1 minute max gap for ad detection
        SESSION_CLEANUP_INTERVAL_MS: 300000, // 5 minutes
        SESSION_MAX_LIFETIME_MS: 86400000, // 24 hours

        // Retry settings for API calls
        MAX_RETRY_ATTEMPTS: 3,
        INITIAL_RETRY_DELAY_MS: 1000, // 1 second
        MAX_RETRY_DELAY_MS: 30000, // 30 seconds
        RETRY_BACKOFF_MULTIPLIER: 2
    },

    // Points Configuration
    POINTS: {
        // Video watching points
        VIDEO_POINTS_PER_SECOND: 0.05, // 0.05 points per second after initial 5 seconds
        VIDEO_INITIAL_SECONDS: 5, // First 5 seconds don't give points

        // Ad watching points
        AD_POINTS_PER_SECOND: 0.5, // 0.5 points per second of ad watching

        // Gems (if implemented)
        GEMS_PER_SECOND: 0.01 // 0.01 gems per second (future feature)
    }
};

// Storage keys
const CONFIG_STORAGE_KEY = 'viewloop_secure_config';
const CONFIG_LAST_UPDATED_KEY = 'viewloop_config_last_updated';
const CONFIG_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Simple encryption/decryption using base64 (for basic obfuscation)
// Note: For production, use proper encryption like AES
function simpleEncrypt(text) {
    return btoa(encodeURIComponent(text));
}

function simpleDecrypt(encoded) {
    try {
        return decodeURIComponent(atob(encoded));
    } catch (e) {
        console.error('❌ [CONFIG] فشل في فك التشفير:', e);
        return null;
    }
}

// Load configuration securely
async function loadSecureConfig() {
    try {
        const stored = await chrome.storage.local.get([CONFIG_STORAGE_KEY, CONFIG_LAST_UPDATED_KEY]);
        const lastUpdated = stored[CONFIG_LAST_UPDATED_KEY];
        const now = Date.now();

        // Check if config needs updating (older than 24 hours)
        if (!lastUpdated || (now - lastUpdated) > CONFIG_UPDATE_INTERVAL_MS) {
            console.log('🔄 [CONFIG] تحديث التكوين من الخادم...');
            await updateConfigFromBackend();
            // Reload after update
            return await loadSecureConfig();
        }

        // Load encrypted config from storage
        const encryptedConfig = stored[CONFIG_STORAGE_KEY];
        if (encryptedConfig) {
            const decrypted = simpleDecrypt(encryptedConfig);
            if (decrypted) {
                const parsedConfig = JSON.parse(decrypted);
                console.log('✅ [CONFIG] تم تحميل التكوين المشفر من التخزين');
                return parsedConfig;
            }
        }

        // Fallback to defaults and save them securely
        console.log('⚠️ [CONFIG] لم يتم العثور على تكوين محفوظ، استخدام القيم الافتراضية');
        await saveSecureConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;

    } catch (error) {
        console.error('❌ [CONFIG] خطأ في تحميل التكوين الآمن:', error);
        return DEFAULT_CONFIG;
    }
}

// Save configuration securely
async function saveSecureConfig(config) {
    try {
        const encrypted = simpleEncrypt(JSON.stringify(config));
        await chrome.storage.local.set({
            [CONFIG_STORAGE_KEY]: encrypted,
            [CONFIG_LAST_UPDATED_KEY]: Date.now()
        });
        console.log('💾 [CONFIG] تم حفظ التكوين بشكل آمن');
    } catch (error) {
        console.error('❌ [CONFIG] خطأ في حفظ التكوين الآمن:', error);
    }
}

// Update configuration from secure backend
async function updateConfigFromBackend() {
    try {
        // This would typically fetch from a secure endpoint
        // For now, we'll just update the timestamp to mark as "fresh"
        console.log('🔄 [CONFIG] محاكاة تحديث التكوين من backend آمن');

        // In production, this would be:
        // const response = await fetch('https://secure-api.example.com/config');
        // const remoteConfig = await response.json();
        // await saveSecureConfig(remoteConfig);

        // For now, just update timestamp
        await chrome.storage.local.set({
            [CONFIG_LAST_UPDATED_KEY]: Date.now()
        });

    } catch (error) {
        console.error('❌ [CONFIG] خطأ في تحديث التكوين من الخادم:', error);
    }
}

// Initialize configuration
async function initializeConfig() {
    if (!globalThis.ViewLoopConfig) {
        globalThis.ViewLoopConfig = await loadSecureConfig();
    }
    return globalThis.ViewLoopConfig;
}

// Define config only once to avoid redeclaration in Service Worker
if (!globalThis.ViewLoopConfig) {
    // For Service Worker compatibility, use sync initialization with defaults
    // then update asynchronously
    globalThis.ViewLoopConfig = DEFAULT_CONFIG;
    initializeConfig().then(config => {
        globalThis.ViewLoopConfig = config;
        console.log('🔧 [CONFIG] تم تحديث التكوين الآمن');
    }).catch(error => {
        console.error('❌ [CONFIG] فشل في تحديث التكوين الآمن:', error);
    });
}

// Export for use in other files (for compatibility)
const CONFIG = globalThis.ViewLoopConfig;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
