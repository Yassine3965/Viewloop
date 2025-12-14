const https = require('https');
const crypto = require('crypto');

// توليد sessionId فريد إذا لم يكن موجودًا
function generateSessionId(userId) {
    return `session_${Date.now()}_${userId}`;
}

// بيانات النبضة الاختبارية الكاملة والصحيحة
function createHeartbeatData(sessionId = null, videoTime = 10, totalHeartbeats = 1, sessionDuration = 5) {
    const now = Date.now();
    const userId = "test_user_123"; // استبدل بـ userId حقيقي إذا لزم الأمر

    return {
        sessionId: sessionId || generateSessionId(userId),
        videoId: "VhokF22OrQE", // يوتيوب videoId صحيح (11 حرف)
        timestamp: now,
        videoTime: videoTime, // الوقت الحالي في الفيديو (بالثواني)
        isPlaying: true, // الفيديو يعمل
        tabActive: true, // التبويبة نشطة
        windowFocused: true, // النافذة مركزة
        mouseActive: true, // الماوس نشط
        lastMouseMove: now - 1000, // آخر حركة ماوس (قبل ثانية)
        sessionDuration: sessionDuration, // مدة الجلسة بالثواني
        totalHeartbeats: totalHeartbeats, // عدد النبضات الإجمالي
        userId: userId // مطلوب للتحقق من ملكية الجلسة
    };
}

const heartbeatData = createHeartbeatData();

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
