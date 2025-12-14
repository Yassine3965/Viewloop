// اختبار توليد التوقيع محلياً
const crypto = require('crypto');

const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// Canonical JSON stringify to ensure consistent key ordering
function canonicalStringify(obj) {
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    sortedKeys.forEach(key => {
        sortedObj[key] = obj[key];
    });
    return JSON.stringify(sortedObj);
}

// توليد التوقيع
function generateSignature(data) {
    const dataString = canonicalStringify(data);
    const combined = dataString + EXTENSION_SECRET;
    return crypto.createHash('sha256').update(combined).digest('hex');
}

// بيانات اختبار
const testData = {
    sessionId: "session_1765743397009_test_user_123",
    videoId: "VhokF22OrQE",
    timestamp: 1765743397009,
    videoTime: 10,
    isPlaying: true,
    tabActive: true,
    windowFocused: true,
    mouseActive: true,
    lastMouseMove: 1765743396009,
    sessionDuration: 5,
    totalHeartbeats: 1,
    deviceFingerprint: "test-fingerprint-76fxssjec",
    sessionStartTime: 1765743397009
};

console.log('البيانات:', testData);
console.log('التوقيع:', generateSignature(testData));

// تحقق من الترتيب
console.log('البيانات المرتبة:', canonicalStringify(testData));
