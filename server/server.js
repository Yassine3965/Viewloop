// =====================================================
//      SECURE VIEWLOOP SERVER — Anti-Cheat Points System
// =====================================================

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// أسرار الأمان - تم إزالة EXTENSION_SECRET، الآن نستخدم sessionToken لكل جلسة

// قاعدة بيانات آمنة للجلسات
const secureSessions = new Map(); // sessionId -> sessionData
const processedSessions = new Set(); // sessionIds التي تم معالجتها

// CORS configuration
const corsOptions = {
  origin: ['https://viewloop.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Signature', 'X-Timestamp', 'X-Request-ID']
};
app.use(require('cors')(corsOptions));

// Stable JSON stringify to ensure consistent key ordering for signatures
function stableStringify(obj) {
    return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {})
    );
}

// Middleware للتحقق من التوقيعات باستخدام sessionToken
const verifySignature = (req, res, next) => {
  try {
    const signature = req.get('X-Signature');

    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const sessionId = req.body.sessionId;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required for signature verification' });
    }

    const session = secureSessions.get(sessionId);
    if (!session || !session.sessionToken) {
      return res.status(401).json({ error: 'Invalid session or session token not found' });
    }

    const sessionToken = session.sessionToken;

    // Check if session is already completed
    if (processedSessions.has(sessionId)) {
      return res.status(401).json({ error: 'Session already completed' });
    }

    // Sign only critical data for specific request types, ALWAYS exclude clientType
    // Include timestamp for replay protection in all critical requests
    const ts = Math.floor(Date.now() / 1000); // Unix timestamp in seconds for replay protection
    let signData;
    if (req.body.__type === 'calculate') {
      // This is calculate-points request
      signData = {
        sessionId: req.body.sessionId,
        videoId: req.body.videoId,
        ts: ts
      };
    } else if (req.body.sessionId && 'videoTime' in req.body && 'isPlaying' in req.body) {
      // This is heartbeat request - include timestamp for replay protection
      signData = {
        sessionId: req.body.sessionId,
        videoTime: req.body.videoTime,
        isPlaying: req.body.isPlaying,
        ts: ts
      };
    } else if (req.body.videoId && req.body.timestamp && !req.body.sessionId) {
      // This is start-session request
      signData = {
        videoId: req.body.videoId,
        timestamp: req.body.timestamp,
        ts: ts
      };
    } else {
      // Other requests - sign data excluding clientType, include ts for replay protection
      signData = { ...req.body, ts: ts };
      delete signData.clientType;
    }

    const dataString = stableStringify(signData);
    const combined = dataString + sessionToken;

    const expectedSignature = crypto.createHash('sha256').update(combined).digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Security verification failed' });
  }
};


// ==========================
// SECURE API ENDPOINTS
// ==========================

// 1. استقبال دفعات النبضات مع التحقق من الأمان
app.post('/heartbeat-batch', verifySignature, (req, res) => {
    const { sessionId, videoId, heartbeats, timestamp } = req.body;

    if (!sessionId || !heartbeats || !Array.isArray(heartbeats)) {
        return res.status(400).json({ error: 'Invalid heartbeat batch data' });
    }

    // إنشاء الجلسة إذا لم تكن موجودة
    if (!secureSessions.has(sessionId)) {
        secureSessions.set(sessionId, {
            sessionId: sessionId,
            videoId: videoId,
            startTime: timestamp,
            heartbeats: [],
            validHeartbeats: 0,
            invalidHeartbeats: 0,
            status: 'active'
        });
    }

    const session = secureSessions.get(sessionId);

    // التحقق من أن الفيديو مطابق
    if (session.videoId !== videoId) {
        return res.status(400).json({ error: 'Video ID mismatch' });
    }

    // معالجة دفعة النبضات
    let validCount = 0;
    let invalidCount = 0;

    heartbeats.forEach(heartbeat => {
        if (validateHeartbeatData(session, heartbeat)) {
            session.heartbeats.push(heartbeat);
            validCount++;
        } else {
            invalidCount++;
            console.log(`🚨 Invalid heartbeat:`, heartbeat);
        }
    });

    session.validHeartbeats += validCount;
    session.invalidHeartbeats += invalidCount;

    console.log(`✅ Processed heartbeat batch: ${validCount} valid, ${invalidCount} invalid`);

    res.json({
        success: true,
        processed: validCount + invalidCount,
        valid: validCount,
        invalid: invalidCount
    });
});

// 2. حساب النقاط النهائي مع التحقق من الأمان
app.post('/calculate-points', verifySignature, (req, res) => {
    const { sessionId, videoId, points, sessionData } = req.body;

    if (!sessionId || processedSessions.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid request or session already processed' });
    }

    const session = secureSessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // إعادة حساب النقاط من جانب الخادم
    const serverCalculatedPoints = calculatePointsSecurely(session);

    // حفظ النقاط النهائية
    const finalPoints = serverCalculatedPoints;
    session.finalPoints = finalPoints;
    session.processed = true;

    processedSessions.add(sessionId);

    // تنظيف بعد 5 دقائق
    setTimeout(() => {
        secureSessions.delete(sessionId);
    }, 300000);

    console.log(`🏆 Points awarded for session ${sessionId}: ${finalPoints.totalPoints}`);

    res.json({
        success: true,
        pointsAwarded: finalPoints.totalPoints,
        breakdown: finalPoints,
        sessionId: sessionId
    });
});

// 3. بدء الجلسة
app.post('/start-session', (req, res) => {
    const { videoID, userID } = req.body;

    if (!videoID) {
        return res.status(400).json({ error: 'Video ID required' });
    }

    // إنشاء رمز جلسة فريد
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // حفظ الجلسة في الذاكرة
    secureSessions.set(sessionToken, {
        sessionId: sessionToken,
        sessionToken: sessionToken,
        videoId: videoID,
        userId: userID || 'anonymous',
        startTime: Date.now(),
        heartbeats: [],
        validHeartbeats: 0,
        invalidHeartbeats: 0,
        validSeconds: 0,
        adSeconds: 0,
        status: 'active'
    });

    console.log(`🚀 Started new session: ${sessionToken} for video ${videoID}`);

    res.json({
        success: true,
        sessionToken: sessionToken,
        message: 'Session started successfully'
    });
});

// 4. التحقق من صحة الفيديو
app.post('/check-video', (req, res) => {
    const { videoId } = req.body;

    if (!videoId) {
        return res.status(400).json({ error: 'Video ID required' });
    }

    // في الإنتاج، تحقق من قاعدة البيانات
    res.json({
        authorized: true,
        exists: true,
        message: 'Video authorized for watching'
    });
});



// دوال مساعدة آمنة
function validateHeartbeatData(session, heartbeat) {
    // التحقق من البيانات الأساسية
    if (!heartbeat.timestamp || !heartbeat.videoTime) {
        return false;
    }

    // التحقق من التسلسل الزمني
    const timeSinceLast = heartbeat.timestamp - (session.lastHeartbeat || session.startTime);
    if (timeSinceLast < 3000) { // أقل من 3 ثواني
        return false;
    }

    // التحقق من النشاط
    if (!heartbeat.tabActive || !heartbeat.mouseActive) {
        if (heartbeat.videoPlaying) {
            return false;
        }
    }

    // التحقق من وقت الفيديو
    if (heartbeat.videoTime < 0 || heartbeat.videoTime > 36000) {
        return false;
    }

    return true;
}

function calculatePointsSecurely(session) {
    const validSeconds = session.validSeconds || 0;
    const adSeconds = session.adSeconds || 0;

    // نقاط الفيديو (بعد أول 5 ثواني)
    const videoWatchSeconds = Math.max(0, validSeconds - 5);
    const videoPoints = videoWatchSeconds * 0.05;

    // نقاط الإعلانات
    let adPoints = 0;
    if (adSeconds > 0) {
        adPoints = Math.floor(adSeconds / 60) * 15; // 15 نقطة لكل دقيقة إعلان
    }

    return {
        videoPoints: Math.round(videoPoints * 100) / 100,
        adPoints: adPoints,
        totalPoints: Math.round((videoPoints + adPoints) * 100) / 100,
        validSeconds: validSeconds,
        adSeconds: adSeconds
    };
}

// 9. نقطة النهاية لإحصائيات الجلسة (محدثة)
app.get('/session-stats/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    const session = secureSessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        sessionId: session.sessionId,
        videoId: session.videoId,
        userId: session.userId,
        startTime: session.startTime,
        validHeartbeats: session.validHeartbeats,
        invalidHeartbeats: session.invalidHeartbeats,
        adSeconds: session.adSeconds,
        status: session.status,
        finalPoints: session.finalPoints || null
    });
});

// 10. نقطة النهاية للصحة
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeSessions: secureSessions.size,
        processedSessions: processedSessions.size
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Watch-to-Earn server listening on port ${PORT}`);
});
