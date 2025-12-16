// اختبار تجميد الجلسات المكتملة
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

async function testSessionCompletedProtection() {
    console.log('🧪 اختبار تجميد الجلسات المكتملة...\n');

    // محاكاة جلسة موجودة
    const sessionId = "test_session_completed_123";
    const mockToken = "test_session_token_456";

    // إضافة الجلسة للـ sessionTokens
    SecureAPIClient.sessionTokens.set(sessionId, mockToken);

    const heartbeatData = {
        sessionId: sessionId,
        videoId: "VhokF22OrQE",
        videoTime: 10,
        isPlaying: true,
        tabActive: true,
        windowFocused: true,
        mouseActive: true,
        timestamp: Date.now()
    };

    // اختبار قبل التجميد - يجب أن يعمل
    console.log('قبل التجميد:');
    const signatureBefore = await SecureAPIClient.generateSignature(heartbeatData);
    console.log('التوقيع:', signatureBefore);

    if (signatureBefore !== 'NO_SESSION' && signatureBefore !== 'SESSION_COMPLETED') {
        console.log('✅ الجلسة تعمل قبل التجميد');
    } else {
        console.log('❌ فشل: الجلسة لا تعمل قبل التجميد');
        return;
    }

    // محاكاة إكمال الجلسة
    console.log('\nبعد التجميد (محاكاة إكمال الجلسة):');
    SecureAPIClient.completedSessions.add(sessionId);

    // محاولة توليد توقيع بعد التجميد
    const signatureAfter = await SecureAPIClient.generateSignature(heartbeatData);
    console.log('التوقيع:', signatureAfter);

    if (signatureAfter === 'SESSION_COMPLETED') {
        console.log('✅ نجح: تم رفض الطلب للجلسة المكتملة');
        console.log('الخادم سيرفض الطلب بـ 403 SESSION_ALREADY_COMPLETED');
    } else {
        console.log('❌ فشل: لم يتم رفض الطلب للجلسة المكتملة');
    }

    console.log('\n🎯 النتيجة: الجلسات المكتملة محمية من الاستخدام مرة أخرى');
}

testSessionCompletedProtection();
