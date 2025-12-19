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
  origin: true, // Allow all origins for local testing
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

    // Use client timestamp for signature verification, but check it's within acceptable range
    const clientTs = req.body.ts || req.body.timestamp;
    const serverTs = Math.floor(Date.now() / 1000);
    const tsDiff = Math.abs(serverTs - (clientTs || 0));

    // Allow 30 seconds difference to account for network latency and clock skew
    if (tsDiff > 30) {
      return res.status(401).json({ error: 'Timestamp out of acceptable range' });
    }

    const ts = clientTs || serverTs; // Use client timestamp if provided, otherwise server timestamp

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
            // تحديث وقت آخر نبضة للتحقق من التسلسل الزمني
            session.lastHeartbeat = heartbeat.timestamp;

            // التحقق من النبضة النهائية
            if (heartbeat.isFinal) {
                session.finalSessionDuration = heartbeat.sessionDuration;
                session.finalRewardTime = heartbeat.rewardTime;
                session.status = 'completed';
                console.log(`🏁 [FINAL-HEARTBEAT] Session ${sessionId} completed: duration=${heartbeat.sessionDuration}s, reward=${heartbeat.rewardTime}s`);
            } else {
                // حساب الوقت الصالح من النبضات (للنبضات العادية فقط)
                if (session.heartbeats.length > 1) {
                    const prevHeartbeat = session.heartbeats[session.heartbeats.length - 2];
                    const timeDiff = heartbeat.timestamp - prevHeartbeat.timestamp;

                    // اعتبار الوقت صالحًا إذا كان التفاوت طبيعيًا (3-8 ثواني)
                    if (timeDiff >= 3000 && timeDiff <= 8000 && heartbeat.isPlaying) {
                        session.validSeconds += Math.floor(timeDiff / 1000);
                    }

                    // كشف المكافآت (فجوات زمنية كبيرة)
                    if (timeDiff > 15000) {
                        const rewardDuration = Math.min(timeDiff - 5000, 60000); // حد أقصى دقيقة
                        session.rewardSeconds += Math.floor(rewardDuration / 1000);
                    }
                }
            }

            validCount++;
        } else {
            invalidCount++;
            console.log(`🚨 Invalid heartbeat:`, heartbeat);
        }
    });

    session.validHeartbeats += validCount;
    session.invalidHeartbeats += invalidCount;

    console.log(`✅ Processed heartbeat batch: ${validCount} valid, ${invalidCount} invalid`);

    // إذا كانت هناك نبضة نهائية، أضف النقاط إلى الاستجابة
    let pointsAwarded = null;
    if (heartbeats.some(h => h.isFinal)) {
        pointsAwarded = calculatePointsSecurely(session);
        console.log(`🏆 Points calculated for session ${sessionId}: ${pointsAwarded.totalPoints}`);
    }

    res.json({
        success: true,
        processed: validCount + invalidCount,
        valid: validCount,
        invalid: invalidCount,
        pointsAwarded: pointsAwarded
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
        // تنظيف processedSessions أيضًا بعد وقت أطول لمنع إعادة المعالجة
        setTimeout(() => {
            processedSessions.delete(sessionId);
        }, 1800000); // 30 دقيقة إضافية لـ processedSessions
    }, 300000);

    console.log(`🏆 Points awarded for session ${sessionId}: ${finalPoints.totalPoints}`);

    res.json({
        success: true,
        pointsAwarded: finalPoints.totalPoints,
        breakdown: finalPoints,
        sessionId: sessionId
    });
});

// 3. بدء الجلسة مع استقبال المدة من العميل
app.post('/start-session', (req, res) => {
    const { videoId, userId, durationSeconds } = req.body;

    if (!videoId) {
        return res.status(400).json({ error: 'Video ID required' });
    }

    // التحقق من صحة المدة المستلمة من العميل
    let videoDuration = 600; // مدة افتراضية 10 دقائق

    if (durationSeconds && typeof durationSeconds === 'number' && durationSeconds > 0 && durationSeconds < 36000) {
        videoDuration = Math.floor(durationSeconds);
        console.log(`📏 [START-SESSION] Client reported duration: ${videoDuration} seconds for video ${videoId}`);
    } else {
        console.log(`⚠️ [START-SESSION] Invalid or missing duration from client, using default: ${videoDuration}s for video ${videoId}`);
    }

    // إنشاء رمز جلسة فريد
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // حفظ الجلسة في الذاكرة مع مدة الفيديو من العميل
    secureSessions.set(sessionToken, {
        sessionId: sessionToken,
        sessionToken: sessionToken,
        videoId: videoId,
        userId: userId || 'anonymous',
        videoDuration: videoDuration, // مدة الفيديو من العميل
        startTime: Date.now(),
        heartbeats: [],
        validHeartbeats: 0,
        invalidHeartbeats: 0,
        validSeconds: 0,
        rewardSeconds: 0,
        status: 'active'
    });

    console.log(`🚀 Started new session: ${sessionToken} for video ${videoId} (${videoDuration}s from client)`);

    res.json({
        success: true,
        sessionToken: sessionToken,
        videoDuration: videoDuration,
        message: 'Session started successfully'
    });
});

// 4. الحصول على مدة الفيديو من YouTube API
app.post('/check-video', async (req, res) => {
    const { videoId } = req.body;

    if (!videoId) {
        return res.status(400).json({ error: 'Video ID required' });
    }

    try {
        const duration = await getVideoDuration(videoId);

        res.json({
            authorized: true,
            exists: duration > 0,
            duration: duration,
            message: 'Video duration retrieved successfully'
        });

    } catch (error) {
        console.error('❌ [CHECK-VIDEO] Error getting video duration:', error);
        // Fallback: افتراض مدة 10 دقائق
        res.json({
            authorized: true,
            exists: true,
            duration: 600,
            message: 'Video authorized with default duration (API error)'
        });
    }
});

// دالة لجلب مدة الفيديو من YouTube API
async function getVideoDuration(videoId, apiKey) {
    try {
        // الحصول على API key من التكوين أو المتغيرات البيئية
        if (!apiKey) {
            const config = globalThis.ViewLoopConfig || {};
            apiKey = config.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
        }

        if (!apiKey) {
            console.warn('⚠️ [YOUTUBE-API] No API key configured, returning 0');
            return 0;
        }

        const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=contentDetails`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            throw new Error('Video not found');
        }

        const durationISO = data.items[0].contentDetails.duration; // ISO 8601
        return parseDuration(durationISO);
    } catch (err) {
        console.error('❌ [YOUTUBE-API] Error fetching video duration:', err.message);
        return 0; // fallback
    }
}

// دالة مساعدة لتحليل مدة الفيديو من تنسيق ISO 8601
function parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = parseInt((match[1] || '').replace('H','')) || 0;
    const minutes = parseInt((match[2] || '').replace('M','')) || 0;
    const seconds = parseInt((match[3] || '').replace('S','')) || 0;

    return hours*3600 + minutes*60 + seconds;
}



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

    // تم تعطيل التحقق من النشاط للسماح بالمشاهدة السلبية (passive watching)

    // التحقق من وقت الفيديو
    if (heartbeat.videoTime < 0 || heartbeat.videoTime > 36000) {
        return false;
    }

    return true;
}

function calculatePointsSecurely(session) {
    // استخدام البيانات من النبضة النهائية إذا كانت متوفرة
    const validSeconds = session.finalSessionDuration !== undefined ? session.finalSessionDuration : (session.validSeconds || 0);
    const rewardSeconds = session.finalRewardTime !== undefined ? session.finalRewardTime : (session.rewardSeconds || 0);

    // استخدام الثوابت من التكوين المركزي
    const config = globalThis.ViewLoopConfig || {};
    const pointsConfig = config.POINTS || {
        VIDEO_POINTS_PER_SECOND: 0.05,
        VIDEO_INITIAL_SECONDS: 5,
        REWARD_POINTS_PER_SECOND: 0.5
    };

    // نقاط الفيديو (بعد أول X ثواني)
    const videoWatchSeconds = Math.max(0, validSeconds - pointsConfig.VIDEO_INITIAL_SECONDS);
    const videoPoints = videoWatchSeconds * pointsConfig.VIDEO_POINTS_PER_SECOND;

    // نقاط المكافآت
    const rewardPoints = rewardSeconds * pointsConfig.REWARD_POINTS_PER_SECOND;

    return {
        videoPoints: Math.round(videoPoints * 100) / 100,
        rewardPoints: rewardPoints,
        totalPoints: Math.round((videoPoints + rewardPoints) * 100) / 100,
        validSeconds: validSeconds,
        rewardSeconds: rewardSeconds
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
        rewardSeconds: session.rewardSeconds,
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Watch-to-Earn server listening on port ${PORT}`);
});
