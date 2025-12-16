// اختبار التعامل مع عدم وجود sessionToken
const { SecureAPIClient } = require('./extension/api.client.js');

// محاكاة البيئة
global.crypto = {
    subtle: {
        digest: async (algorithm, data) => {
            const crypto = require('crypto');
            return crypto.createHash('sha256').update(data).digest();
        }
    }
};

global.TextEncoder = require('util').TextEncoder;

// محاكاة CONFIG
global.CONFIG = {
    ENDPOINTS: {
        HEARTBEAT: '/api/heartbeat-data'
    }
};

global.API_BASE_URL = 'http://localhost:3000';

async function testNoSessionHandling() {
    console.log('🧪 اختبار التعامل مع عدم وجود sessionToken...\n');

    // محاولة إرسال heartbeat بدون وجود session token
    const testHeartbeatData = {
        sessionId: "nonexistent_session_123",
        videoId: "VhokF22OrQE",
        videoTime: 10,
        isPlaying: true,
        tabActive: true,
        windowFocused: true,
        mouseActive: true,
        timestamp: Date.now()
    };

    try {
        // هذا سيحاول توليد توقيع لكن sessionToken غير موجود
        const signature = await SecureAPIClient.generateSignature(testHeartbeatData);

        console.log('التوقيع المُرجع:', signature);

        if (signature === 'NO_SESSION') {
            console.log('✅ نجح: تم إرجاع "NO_SESSION" بدلاً من رمي خطأ');
            console.log('الخادم سيرفض الطلب بشكل صحيح');
        } else {
            console.log('❌ فشل: لم يتم إرجاع "NO_SESSION"');
        }

    } catch (error) {
        console.log('❌ فشل: تم رمي خطأ بدلاً من إرجاع قيمة', error.message);
    }

    console.log('\n🎯 النتيجة: الإضافة لن تتوقف بالكامل عند فقدان الجلسة');
}

testNoSessionHandling();
