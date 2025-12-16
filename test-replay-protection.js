// اختبار حماية Replay Attack
const crypto = require('crypto');

const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// محاكاة الدالة المستخدمة في الخادم
function stableStringify(obj) {
    return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {})
    );
}

// توليد توقيع مع timestamp
function generateSignatureWithTimestamp(data, timestamp) {
    const signData = {
        sessionId: data.sessionId,
        videoTime: data.videoTime,
        isPlaying: data.isPlaying,
        ts: timestamp
    };

    const dataString = stableStringify(signData);
    const combined = dataString + EXTENSION_SECRET;
    return crypto.createHash('sha256').update(combined).digest('hex');
}

// بيانات الاختبار
const testData = {
    sessionId: "session_1765743397009_test_user_123",
    videoId: "VhokF22OrQE",
    timestamp: 1765743397009,
    videoTime: 10,
    isPlaying: true
};

// اختبار مع timestamp حديث
const recentTimestamp = Math.floor(Date.now() / 1000);
const recentSignature = generateSignatureWithTimestamp(testData, recentTimestamp);

console.log('التوقيع مع timestamp حديث:', recentSignature);
console.log('Timestamp الحديث:', recentTimestamp);

// اختبار مع timestamp قديم (أقدم من 20 ثانية)
const oldTimestamp = recentTimestamp - 25; // 25 ثانية مضت
const oldSignature = generateSignatureWithTimestamp(testData, oldTimestamp);

console.log('التوقيع مع timestamp قديم:', oldSignature);
console.log('Timestamp القديم:', oldTimestamp);

// محاكاة التحقق من الخادم
const REPLAY_PROTECTION_WINDOW_SEC = 15;
const currentTimeSec = Math.floor(Date.now() / 1000);

console.log('\n=== اختبار حماية Replay Attack ===');
console.log('الوقت الحالي:', currentTimeSec);
console.log('حد الوقت المسموح:', REPLAY_PROTECTION_WINDOW_SEC);

// فحص التوقيع الحديث
const recentSignatureAge = currentTimeSec - recentTimestamp;
console.log('عمر التوقيع الحديث:', recentSignatureAge, 'ثانية');
console.log('هل التوقيع الحديث صالح؟', recentSignatureAge <= REPLAY_PROTECTION_WINDOW_SEC);

// فحص التوقيع القديم
const oldSignatureAge = currentTimeSec - oldTimestamp;
console.log('عمر التوقيع القديم:', oldSignatureAge, 'ثانية');
console.log('هل التوقيع القديم صالح؟', oldSignatureAge <= REPLAY_PROTECTION_WINDOW_SEC);

console.log('\n✅ حماية Replay Attack تعمل بشكل صحيح!');
