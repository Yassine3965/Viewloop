// اختبار ثبات التوقيع مع تغيير ترتيب المفاتيح
const crypto = require('crypto');

const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// Stable JSON stringify to ensure consistent key ordering for signatures
function stableStringify(obj) {
    return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {})
    );
}

// توليد التوقيع
function generateSignature(data) {
    const dataString = stableStringify(data);
    const combined = dataString + EXTENSION_SECRET;
    return crypto.createHash('sha256').update(combined).digest('hex');
}

// بيانات اختبار بنفس القيم لكن بترتيب مختلف
const testData1 = {
    sessionId: "session_1765743397009_test_user_123",
    videoId: "VhokF22OrQE",
    timestamp: 1765743397009,
    videoTime: 10,
    isPlaying: true
};

const testData2 = {
    isPlaying: true,
    videoTime: 10,
    timestamp: 1765743397009,
    videoId: "VhokF22OrQE",
    sessionId: "session_1765743397009_test_user_123"
};

const testData3 = {
    timestamp: 1765743397009,
    sessionId: "session_1765743397009_test_user_123",
    isPlaying: true,
    videoId: "VhokF22OrQE",
    videoTime: 10
};

console.log('البيانات 1:', testData1);
console.log('التوقيع 1:', generateSignature(testData1));

console.log('البيانات 2:', testData2);
console.log('التوقيع 2:', generateSignature(testData2));

console.log('البيانات 3:', testData3);
console.log('التوقيع 3:', generateSignature(testData3));

console.log('هل التوقيعات متطابقة؟', generateSignature(testData1) === generateSignature(testData2) && generateSignature(testData2) === generateSignature(testData3));
