const https = require('https');
const crypto = require('crypto');

// بيانات الجلسة الأساسية
const baseHeartbeat = {
    sessionId: "multi-test-" + Date.now(),
    videoId: "VhokF22OrQE",
    timestamp: Date.now(),
    videoTime: 0,
    isPlaying: true,
    tabActive: true,
    windowFocused: true,
    mouseActive: true,
    lastMouseMove: Date.now(),
    sessionDuration: 0,
    totalHeartbeats: 0
};

// سر الإضافة وبصمة الجهاز (محاكاة)
const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";
const DEVICE_FINGERPRINT = "test-fingerprint-" + Math.random().toString(36).substr(2, 9);
const SESSION_START_TIME = Date.now();

// توليد التوقيع
function generateSignature(data) {
    const dataString = JSON.stringify(data);
    const combined = dataString + EXTENSION_SECRET;
    return crypto.createHash('sha256').update(combined).digest('hex');
}

// إرسال نبضة واحدة
function sendHeartbeat(heartbeatData, heartbeatNumber) {
    return new Promise((resolve, reject) => {
        // إضافة deviceFingerprint و sessionStartTime كما في الإضافة
        const enrichedData = {
            ...heartbeatData,
            deviceFingerprint: DEVICE_FINGERPRINT,
            videoId: baseHeartbeat.videoId,
            sessionStartTime: SESSION_START_TIME
        };

        const signature = generateSignature(enrichedData);
        const postData = JSON.stringify(enrichedData);

        const options = {
            hostname: 'viewloop.vercel.app',
            port: 443,
            path: '/api/heartbeat-data',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature': signature,
                'X-Session-ID': heartbeatData.sessionId,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log(`📡 نبضة ${heartbeatNumber}: حالة ${res.statusCode}, نقاط: ${response.points?.totalPoints || 0}, validHeartbeats: ${response.points?.validSeconds || 0}`);
                    resolve({ status: res.statusCode, response, heartbeatNumber });
                } catch (e) {
                    console.error(`❌ خطأ في تحليل استجابة نبضة ${heartbeatNumber}:`, data);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ خطأ في طلب نبضة ${heartbeatNumber}:`, e.message);
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

// اختبار نبضات متعددة
async function runMultiHeartbeatTest() {
    console.log('🧪 بدء اختبار النبضات المتعددة...\n');
    console.log('🔐 بصمة الجهاز:', DEVICE_FINGERPRINT);
    console.log('⏰ وقت بدء الجلسة:', new Date(SESSION_START_TIME).toLocaleTimeString());
    console.log('');

    const results = [];
    let currentVideoTime = 0;
    let totalDuration = 0;

    // إرسال 10 نبضات (كل 5 ثواني، كما في النظام الحقيقي)
    for (let i = 1; i <= 10; i++) {
        currentVideoTime += 5; // زيادة 5 ثواني
        totalDuration += 5;

        const heartbeatData = {
            ...baseHeartbeat,
            timestamp: SESSION_START_TIME + (i * 5000), // زيادة 5 ثواني
            videoTime: currentVideoTime,
            sessionDuration: totalDuration,
            totalHeartbeats: i
        };

        try {
            const result = await sendHeartbeat(heartbeatData, i);
            results.push(result);

            // انتظار ثانيتين بين النبضات (محاكاة السلوك الطبيعي)
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`❌ فشل نبضة ${i}:`, error.message);
            break;
        }
    }

    // تحليل النتائج
    console.log('\n📊 تحليل النتائج:');
    console.log('================');

    const successful = results.filter(r => r.status === 200);
    const lastResponse = successful[successful.length - 1]?.response;

    if (lastResponse) {
        console.log(`✅ إجمالي النبضات الناجحة: ${successful.length}/10`);
        console.log(`🎯 النقاط النهائية: ${lastResponse.points?.totalPoints || 0}`);
        console.log(`⏱️ الثواني الصالحة: ${lastResponse.points?.validSeconds || 0}`);
        console.log(`💓 إجمالي النبضات: ${lastResponse.totalHeartbeats || 0}`);
        console.log(`📊 حالة الجلسة: ${lastResponse.sessionStatus || 'unknown'}`);

        // التحقق من منطق النقاط
        const expectedPoints = Math.max(0, (lastResponse.points?.validSeconds || 0) - 5) * 0.05;
        const actualPoints = lastResponse.points?.totalPoints || 0;

        console.log(`\n🔍 تحقق النقاط:`);
        console.log(`   - الثواني الصالحة: ${lastResponse.points?.validSeconds || 0}`);
        console.log(`   - الثواني المستخدمة في الحساب: ${Math.max(0, (lastResponse.points?.validSeconds || 0) - 5)}`);
        console.log(`   - النقاط المتوقعة: ${expectedPoints.toFixed(2)}`);
        console.log(`   - النقاط الفعلية: ${actualPoints}`);
        console.log(`   - التطابق: ${Math.abs(expectedPoints - actualPoints) < 0.01 ? '✅' : '❌'}`);

    } else {
        console.log('❌ لا توجد استجابات ناجحة للتحليل');
    }

    console.log('\n🏁 انتهاء اختبار النبضات المتعددة');
}

// تشغيل الاختبار
runMultiHeartbeatTest().catch(console.error);
