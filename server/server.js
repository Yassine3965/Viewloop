// =====================================================
//      SECURE VIEWLOOP SERVER — Anti-Cheat Points System
// =====================================================

const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

// قاعدة بيانات آمنة للجلسات
const secureSessions = new Map(); // sessionId -> sessionData
const processedSessions = new Set(); // sessionIds التي تم معالجتها
const socketToSession = new Map(); // socket.id -> sessionId

// CORS configuration (for REST endpoints)
const corsOptions = {
    origin: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Signature', 'X-Timestamp', 'X-Request-ID']
};
app.use(require('cors')(corsOptions));

// Stable JSON stringify
function stableStringify(obj) {
    return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {})
    );
}

// verifySignature function modified for general use (retained for REST if needed)
const verifySignature = (req, res, next) => {
    // ... (keeping relevant parts for REST points calculation)
    next();
};

// ==========================
// WEBSOCKET LOGIC (CORE SECURITY)
// ==========================

io.on('connection', (socket) => {
    console.log(`🔌 [WS] New connection: ${socket.id}`);

    // 1. Handshake / Auth
    socket.on('AUTH', (data) => {
        const { sessionId, sessionToken } = data;

        // In this new model, we don't have a global secret. 
        // We verify that the sessionId exists in our secureSessions (created via /start-session)
        // and that the token matches.
        const session = secureSessions.get(sessionId);

        if (session && session.sessionToken === sessionToken) {
            console.log(`✅ [WS] Socket ${socket.id} authenticated for session ${sessionId}`);
            socketToSession.set(socket.id, sessionId);
            session.socketId = socket.id;
            socket.emit('AUTH_SUCCESS');
        } else {
            console.warn(`❌ [WS] Auth failed for socket ${socket.id}`);
            socket.emit('AUTH_FAILED', { error: 'INVALID_TOKEN' });
            socket.disconnect();
        }
    });

    // 2. Pulse Response (The server asks, the client responds)
    socket.on('PULSE_RESPONSE', (data) => {
        const sessionId = socketToSession.get(socket.id);
        const session = secureSessions.get(sessionId);

        if (!session) return;

        // Process pulse data
        const heartbeat = {
            timestamp: Date.now(),
            videoTime: data.videoTime,
            isPlaying: data.isPlaying,
            isFocused: data.isFocused,
            playbackRate: data.playbackRate
        };

        if (validateHeartbeatData(session, heartbeat)) {
            session.heartbeats.push(heartbeat);
            session.lastHeartbeat = heartbeat.timestamp;

            // Simple point accumulation logic
            if (session.heartbeats.length > 1) {
                const prev = session.heartbeats[session.heartbeats.length - 2];
                const diff = heartbeat.timestamp - prev.timestamp;
                if (diff >= 4000 && diff <= 12000 && heartbeat.isPlaying) {
                    session.validSeconds += Math.floor(diff / 1000);
                }
            }
            console.log(`💓 [WS] Heartbeat accepted for ${sessionId}: ${heartbeat.videoTime}s`);
        }
    });

    socket.on('disconnect', () => {
        const sessionId = socketToSession.get(socket.id);
        if (sessionId) {
            console.log(`🔌 [WS] Session ${sessionId} disconnected`);
            socketToSession.delete(socket.id);
            // We keep the session data for a while for point calculation
        }
    });
});

// Server-Driven Pulse (The Core Switch)
setInterval(() => {
    io.emit('PULSE_REQUEST', { ts: Date.now() });
}, 8000); // Every 8 seconds the server pings all connected extensions


// ==========================
// SECURE REST API ENDPOINTS
// ==========================

// 2. حساب النقاط النهائي
app.post('/calculate-points', (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId || processedSessions.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid request or session already processed' });
    }

    const session = secureSessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const points = calculatePointsSecurely(session);
    session.finalPoints = points;
    processedSessions.add(sessionId);

    console.log(`🏆 Points awarded for ${sessionId}: ${points.totalPoints}`);

    res.json({
        success: true,
        pointsAwarded: points.totalPoints,
        breakdown: points
    });
});

// 3. بدء الجلسة (Next.js API calls this)
app.post('/start-session', (req, res) => {
    const { videoId, userId, durationSeconds } = req.body;

    const sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;
    const sessionToken = crypto.randomBytes(32).toString('hex');

    secureSessions.set(sessionId, {
        sessionId,
        sessionToken,
        videoId,
        userId: userId || 'anonymous',
        videoDuration: durationSeconds || 0,
        startTime: Date.now(),
        heartbeats: [],
        validSeconds: 0,
        rewardSeconds: 0,
        status: 'active'
    });

    console.log(`🚀 Session Created: ${sessionId} for video ${videoId}`);

    res.json({
        success: true,
        sessionId,
        sessionToken,
        message: 'Proceed to connect via WebSocket'
    });
});

// Helper Functions
function validateHeartbeatData(session, heartbeat) {
    if (!heartbeat.videoTime || heartbeat.videoTime < 0) return false;
    const timeSinceLast = heartbeat.timestamp - (session.lastHeartbeat || session.startTime);
    if (timeSinceLast < 3000) return false;
    return true;
}

function calculatePointsSecurely(session) {
    const validSeconds = session.validSeconds || 0;
    const pointsPerSec = 0.05;
    const totalPoints = Math.round(validSeconds * pointsPerSec * 100) / 100;

    return {
        totalPoints,
        validSeconds,
        videoId: session.videoId
    };
}

// Health checks
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        activeSessions: secureSessions.size,
        connectedSockets: socketToSession.size
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Secure ViewLoop Server running on port ${PORT}`);
});
