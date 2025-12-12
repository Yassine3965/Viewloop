const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());

// هام: يجب أن يكون هذا المفتاح السري مطابقًا للمفتاح المستخدم في الإضافة
// ويجب تخزينه بشكل آمن في بيئة الإنتاج (environment variable)
const HMAC_SECRET_KEY = 'YOUR_SUPER_SECRET_KEY'; 
const EXPECTED_EXTENSION_ID = 'YOUR_CHROME_EXTENSION_ID'; // استبدل بمعرف الإضافة الخاص بك

// CORS configuration to allow requests only from the specified website and extension
const corsOptions = {
  origin: function (origin, callback) {
    // يسمح بالطلبات من موقع الويب الخاص بك والإضافة
    // في بيئة الإنتاج، يجب أن تكون أكثر تحديدًا
    const allowedOrigins = ['https://viewloop.vercel.app', `chrome-extension://${EXPECTED_EXTENSION_ID}`];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));


// قاعدة بيانات وهمية لتخزين جلسات المشاهدة النشطة
// في تطبيق حقيقي، ستستخدم قاعدة بيانات مثل Redis أو MongoDB
const activeSessions = new Map();

// Middleware للتحقق من أصل الطلب (Extension ID)
const verifyOrigin = (req, res, next) => {
    const origin = req.get('origin');
    // يتم تعيين Origin تلقائيًا بواسطة Chrome للطلبات من الإضافات
    if (origin !== `chrome-extension://${EXPECTED_EXTENSION_ID}`) {
        // 403 Forbidden: إذا لم يكن الطلب من الإضافة المسموح بها
        return res.status(403).json({ error: 'Forbidden: Invalid request origin.' });
    }
    next();
};


// 1. نقطة النهاية لبدء جلسة مشاهدة جديدة
app.post('/start-session', (req, res) => {
    const { videoID, userID } = req.body;

    if (!videoID || !userID) {
        return res.status(400).json({ error: 'videoID and userID are required.' });
    }

    // --[Security Check: Anti-Cheat]--
    // التحقق مما إذا كان المستخدم لديه بالفعل جلسة نشطة
    for (const [token, session] of activeSessions.entries()) {
        if (session.userID === userID) {
            return res.status(409).json({ error: 'User already has an active watching session.' });
        }
    }

    // --[Security: Session Token]--
    // إنشاء رمز جلسة فريد ومؤقت
    const sessionToken = jwt.sign({ userID, videoID, type: 'session' }, HMAC_SECRET_KEY, { expiresIn: '3h' }); // صلاحية الرمز 3 ساعات كحد أقصى
    const server_start_time = Date.now(); // milliseconds

    // تخزين بيانات الجلسة
    activeSessions.set(sessionToken, {
        userID,
        videoID,
        server_start_time,
        last_heartbeat_time: server_start_time,
        accumulated_watch_time: 0, // الوقت المتراكم بالثواني
        heartbeat_count: 0
    });

    console.log(`Session started for user ${userID} on video ${videoID}`);
    res.json({ sessionToken });
});

// 2. نقطة النهاية لاستقبال النبضات (Heartbeat)
app.post('/heartbeat', verifyOrigin, (req, res) => {
    const { sessionToken } = req.body;

    if (!sessionToken) {
        return res.status(400).json({ error: 'Session token is required.' });
    }

    // --[Security: Token Validation]--
    // التحقق من صحة الرمز
    try {
        jwt.verify(sessionToken, HMAC_SECRET_KEY);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    const session = activeSessions.get(sessionToken);

    // التحقق من وجود الجلسة
    if (!session) {
        return res.status(404).json({ error: 'Session not found or has been completed.' });
    }

    const currentTime = Date.now();

    // --[Security Check: Server-Side Time Validation]--
    // حساب الفاصل الزمني منذ النبضة الأخيرة على الخادم
    const timeSinceLastHeartbeat = (currentTime - session.last_heartbeat_time) / 1000; // بالثواني

    // --[Security Check: Anti-Speed Hacking]--
    // يجب أن يكون الفاصل الزمني حوالي 10 ثوانٍ. نسمح بهامش صغير (e.g., 9-12 seconds).
    if (timeSinceLastHeartbeat < 9) {
        // إذا أرسل العميل النبضات بسرعة كبيرة، فهذه علامة على الغش
        activeSessions.delete(sessionToken); // إنهاء الجلسة
        return res.status(400).json({ error: 'Heartbeat received too frequently. Session terminated.' });
    }
    
    // نسمح بحد أقصى 12 ثانية لتجنب المشاكل الناتجة عن بطء الشبكة
    const effective_watch_time = Math.min(timeSinceLastHeartbeat, 12);


    // تحديث بيانات الجلسة
    session.accumulated_watch_time += effective_watch_time;
    session.last_heartbeat_time = currentTime;
    session.heartbeat_count++;
    
    console.log(`Heartbeat for user ${session.userID}. Accumulated time: ${session.accumulated_watch_time.toFixed(2)}s`);

    res.json({ status: 'ok' });
});

// 3. نقطة النهاية لإكمال الجلسة ومنح النقاط
app.post('/complete', verifyOrigin, (req, res) => {
    const { sessionToken, videoDuration } = req.body; // videoDuration comes from the client, in seconds

    if (!sessionToken || !videoDuration) {
        return res.status(400).json({ error: 'Session token and videoDuration are required.' });
    }
    
    try {
        jwt.verify(sessionToken, HMAC_SECRET_KEY);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    const session = activeSessions.get(sessionToken);

    if (!session) {
        return res.status(404).json({ error: 'Session not found or already completed.' });
    }

    // --[Security Check: Final Validation]--
    // التحقق مما إذا كان الوقت المتراكم يطابق مدة الفيديو (بنسبة تسامح، مثلا 95%)
    // هذا يمنع المستخدم من إرسال طلب "complete" في وقت مبكر.
    const requiredWatchTime = videoDuration * 0.95; 

    if (session.accumulated_watch_time >= requiredWatchTime) {
        // ---[Award Points Logic Here]---
        // هنا تقوم باستدعاء نظام النقاط الخاص بك لمنح المستخدم نقاطه
        // مثلا: awardPoints(session.userID, calculatePoints(videoDuration));
        console.log(`User ${session.userID} completed video ${session.videoID} and earned points.`);
        
        // حذف الجلسة بعد اكتمالها بنجاح
        activeSessions.delete(sessionToken);

        res.json({ success: true, message: 'Video completed successfully. Points awarded.' });
    } else {
        // إذا لم يتم استيفاء شرط المشاهدة
        activeSessions.delete(sessionToken); // حذف الجلسة الفاشلة
        res.status(400).json({ 
            success: false, 
            message: `Watch time requirement not met. Watched: ${session.accumulated_watch_time.toFixed(2)}s, Required: ${requiredWatchTime.toFixed(2)}s.`
        });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Watch-to-Earn server listening on port ${PORT}`);
});
