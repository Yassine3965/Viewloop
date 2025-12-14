// =====================
// مثال حساب النقاط في الخادم - ViewLoop Secure Points Calculator
// =====================

// هذا الملف يوضح كيفية حساب النقاط في الخادم بناءً على النبضات المرسلة من الإضافة

class SecurePointsCalculator {
    constructor() {
        this.POINTS_PER_SECOND = 0.05; // 0.05 نقطة لكل ثانية مشاهدة
        this.AD_POINTS_PER_SECOND = 15; // 15 نقطة لكل 15 ثانية إعلان
        this.MIN_WATCH_SECONDS = 5; // أول 5 ثواني لا نقاط
    }

    /**
     * حساب النقاط من جلسة كاملة
     * @param {Object} session - بيانات الجلسة من قاعدة البيانات
     * @returns {Object} - تفاصيل النقاط المحسوبة
     */
    calculateSessionPoints(session) {
        console.log(`🔢 حساب النقاط للجلسة: ${session.sessionId}`);

        const validHeartbeats = session.heartbeats.filter(hb => hb.isValid);
        const totalValidSeconds = validHeartbeats.length * 5; // كل نبضة تمثل 5 ثواني

        // حساب وقت المشاهدة الفعلي (بعد أول 5 ثواني)
        const videoWatchSeconds = Math.max(0, totalValidSeconds - this.MIN_WATCH_SECONDS);
        const videoPoints = videoWatchSeconds * this.POINTS_PER_SECOND;

        // كشف الإعلانات و حساب نقاطها
        const adData = this.detectAds(validHeartbeats);
        const adPoints = adData.adSeconds * (this.AD_POINTS_PER_SECOND / 15);

        // التحقق من التلاعب
        const fraudCheck = this.checkForFraud(session, validHeartbeats);

        const totalPoints = fraudCheck.isFraud ? 0 : (videoPoints + adPoints);

        return {
            sessionId: session.sessionId,
            videoId: session.videoId,
            validSeconds: totalValidSeconds,
            videoWatchSeconds: videoWatchSeconds,
            videoPoints: Math.round(videoPoints * 100) / 100,
            adSeconds: adData.adSeconds,
            adPoints: Math.round(adPoints * 100) / 100,
            totalPoints: Math.round(totalPoints * 100) / 100,
            fraudDetected: fraudCheck.isFraud,
            fraudReasons: fraudCheck.reasons,
            calculationTimestamp: Date.now()
        };
    }

    /**
     * كشف الإعلانات من نمط النبضات
     * @param {Array} heartbeats - النبضات الصالحة
     * @returns {Object} - بيانات الإعلانات
     */
    detectAds(heartbeats) {
        if (!heartbeats || heartbeats.length < 2) {
            return { hasAds: false, adSeconds: 0, adCount: 0 };
        }

        let adSeconds = 0;
        let adCount = 0;

        for (let i = 1; i < heartbeats.length; i++) {
            const current = heartbeats[i];
            const previous = heartbeats[i - 1];

            // حساب الفجوة الزمنية
            const timeGap = current.videoTime - previous.videoTime;
            const receivedGap = current.receivedAt - previous.receivedAt;

            // كشف الإعلان: فجوة زمنية كبيرة مع فجوة في الاستقبال أصغر
            if (timeGap > 15 && receivedGap < timeGap * 1000) {
                // إعلان محتمل
                const adDuration = Math.min(timeGap - 5, 60); // حد أقصى دقيقة
                adSeconds += adDuration;
                adCount++;

                console.log(`📺 إعلان مكتشف: ${adDuration}s في ${current.videoTime}s`);
            }
        }

        return {
            hasAds: adSeconds > 0,
            adSeconds: Math.floor(adSeconds),
            adCount: adCount
        };
    }

    /**
     * التحقق من التلاعب في الجلسة
     * @param {Object} session - بيانات الجلسة
     * @param {Array} heartbeats - النبضات
     * @returns {Object} - نتيجة فحص التلاعب
     */
    checkForFraud(session, heartbeats) {
        const reasons = [];

        // 1. عدد كبير جداً من النبضات غير الصالحة
        const invalidRatio = session.invalidHeartbeats / (session.validHeartbeats + session.invalidHeartbeats);
        if (invalidRatio > 0.5) {
            reasons.push('TOO_MANY_INVALID_HEARTBEATS');
        }

        // 2. جلسة قصيرة جداً
        if (session.validSeconds < 10) {
            reasons.push('SESSION_TOO_SHORT');
        }

        // 3. فجوات زمنية مشبوهة
        if (heartbeats.length > 1) {
            const gaps = [];
            for (let i = 1; i < heartbeats.length; i++) {
                gaps.push(heartbeats[i].receivedAt - heartbeats[i-1].receivedAt);
            }

            const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const maxGap = Math.max(...gaps);

            if (maxGap > 300000) { // فجوة أكبر من 5 دقائق
                reasons.push('SUSPICIOUS_TIME_GAPS');
            }
        }

        // 4. نشاط غير طبيعي
        const inactiveHeartbeats = heartbeats.filter(hb => !hb.mouseActive && hb.isPlaying).length;
        if (inactiveHeartbeats > heartbeats.length * 0.3) {
            reasons.push('EXCESSIVE_INACTIVE_TIME');
        }

        return {
            isFraud: reasons.length > 0,
            reasons: reasons
        };
    }

    /**
     * حفظ النقاط في قاعدة البيانات
     * @param {Object} pointsData - بيانات النقاط المحسوبة
     * @param {Object} db - كائن قاعدة البيانات
     */
    async savePoints(pointsData, db) {
        try {
            const sessionRef = db.collection('sessions').doc(pointsData.sessionId);
            const userRef = db.collection('users').doc(pointsData.userId);

            // تحديث الجلسة
            await sessionRef.update({
                pointsCalculated: true,
                points: pointsData,
                calculatedAt: new Date(),
                status: pointsData.fraudDetected ? 'fraud_detected' : 'completed'
            });

            // تحديث نقاط المستخدم (إذا لم يكن تلاعب)
            if (!pointsData.fraudDetected && pointsData.totalPoints > 0) {
                await userRef.update({
                    totalPoints: db.FieldValue.increment(pointsData.totalPoints),
                    lastActivity: new Date(),
                    sessionsCount: db.FieldValue.increment(1)
                });
            }

            console.log(`✅ النقاط محفوظة: ${pointsData.totalPoints} للمستخدم ${pointsData.userId}`);
            return { success: true };

        } catch (error) {
            console.error('❌ خطأ في حفظ النقاط:', error);
            return { success: false, error: error.message };
        }
    }
}

// =====================
// مثال الاستخدام
// =====================

/*
// بيانات جلسة وهمية من قاعدة البيانات
const mockSession = {
    sessionId: 'session_1234567890_abc123',
    videoId: 'dQw4w9WgXcQ',
    userId: 'user_123',
    startTime: Date.now() - 300000, // 5 دقائق مضت
    validHeartbeats: 50,
    invalidHeartbeats: 5,
    heartbeats: [
        { videoTime: 0, isPlaying: true, mouseActive: true, tabActive: true, receivedAt: Date.now() - 300000 },
        { videoTime: 5, isPlaying: true, mouseActive: true, tabActive: true, receivedAt: Date.now() - 295000 },
        { videoTime: 10, isPlaying: true, mouseActive: true, tabActive: true, receivedAt: Date.now() - 290000 },
        // ... المزيد من النبضات
        { videoTime: 250, isPlaying: true, mouseActive: true, tabActive: true, receivedAt: Date.now() - 50000 },
    ]
};

const calculator = new SecurePointsCalculator();
const points = calculator.calculateSessionPoints(mockSession);

console.log('نتيجة حساب النقاط:', points);
// Output:
// {
//   sessionId: 'session_1234567890_abc123',
//   videoId: 'dQw4w9WgXcQ',
//   validSeconds: 250,
//   videoWatchSeconds: 245,
//   videoPoints: 12.25,
//   adSeconds: 0,
//   adPoints: 0,
//   totalPoints: 12.25,
//   fraudDetected: false,
//   fraudReasons: [],
//   calculationTimestamp: 1234567890123
// }
*/

module.exports = SecurePointsCalculator;
