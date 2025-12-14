const https = require('https');
const crypto = require('crypto');

// بيانات النبضة الاختبارية
const heartbeatData = {
    sessionId: "test",
    videoId: "VhokF22OrQE",
    timestamp: 1234567,
    videoTime: 0,
    isPlaying: true,
    tabActive: true,
    windowFocused: true,
    mouseActive: true,
    lastMouseMove: 1234567,
    sessionDuration: 0,
    totalHeartbeats: 1
};

// سر الإضافة (من extension/config.js أو background.js)
const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// توليد التوقيع
function generateSignature(data) {
    const dataString = JSON.stringify(data);
    const combined = dataString + EXTENSION_SECRET;
    return crypto.createHash('sha256').update(combined).digest('hex');
}

// إرسال الطلب
function sendHeartbeatRequest() {
    const signature = generateSignature(heartbeatData);
    const postData = JSON.stringify(heartbeatData);

    const options = {
        hostname: 'viewloop.vercel.app',
        port: 443,
        path: '/api/heartbeat-data',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    console.log('🔐 توليد التوقيع:', signature);
    console.log('📤 إرسال البيانات:', postData);

    const req = https.request(options, (res) => {
        console.log(`📡 حالة الاستجابة: ${res.statusCode}`);

        res.on('data', (chunk) => {
            const response = chunk.toString();
            console.log('📥 استجابة الخادم:', response);

            try {
                const jsonResponse = JSON.parse(response);
                if (jsonResponse.success === true) {
                    console.log('✅ نجح الاتصال! الخادم يعمل بشكل صحيح.');
                } else {
                    console.log('⚠️ الخادم يعمل لكن الاستجابة غير متوقعة:', jsonResponse);
                }
            } catch (e) {
                console.log('⚠️ استجابة غير JSON:', response);
            }
        });
    });

    req.on('error', (e) => {
        console.error('❌ خطأ في الطلب:', e.message);
    });

    req.write(postData);
    req.end();
}

// تشغيل الاختبار
console.log('🧪 بدء اختبار اتصال heartbeat API...\n');
sendHeartbeatRequest();
