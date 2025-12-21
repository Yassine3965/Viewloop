// =====================================================
//      SECURE VIEWLOOP SERVER — Pulse-Driven Brain 🧠
// =====================================================

const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.json());
app.use(require('cors')());

const secureSessions = new Map(); // sessionId -> sessionData
const socketToSession = new Map(); // socket.id -> sessionId

const NEXTJS_API_URL = process.env.NEXTJS_API_URL || "https://viewloop.vercel.app";

// ==========================
// DB SYNC LOGIC
// ==========================
async function syncSessionToDatabase(sessionId) {
    const session = secureSessions.get(sessionId);
    if (!session || session.synced) return;

    console.log(`📡 [SYNC] Finalizing points for ${sessionId}: ${session.validSeconds}s`);

    // Prepare body for Next.js API
    // Must match what Next.js expects: { sessionId, videoId, points: 0, sessionData: { validSeconds } }
    const body = {
        sessionId: session.sessionId,
        videoId: session.videoId || "UNKNOWN", // VideoId should ideally be passed in AUTH or fetched
        points: 0,
        sessionData: { validSeconds: session.validSeconds }
    };

    // Next.js signature logic: hash(JSON.stringify(sortedBody) + sessionToken)
    const sortedKeys = Object.keys(body).sort();
    const sortedBody = {};
    sortedKeys.forEach(k => sortedBody[k] = body[k]);
    const dataString = JSON.stringify(sortedBody);

    const combined = dataString + session.sessionToken;
    const signature = crypto.createHash('sha256').update(combined).digest('hex');

    try {
        const response = await fetch(`${NEXTJS_API_URL}/api/calculate-points`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature': signature
            },
            body: dataString
        });

        const result = await response.json();
        if (response.ok) {
            console.log(`✅ [SYNC] Successfully persisted ${sessionId}. Points Awarded: ${result.pointsAwarded}`);
            session.synced = true;
            secureSessions.delete(sessionId);
        } else {
            console.error(`❌ [SYNC] Failed to persist ${sessionId}:`, result.error || result);
        }
    } catch (err) {
        console.error(`❌ [SYNC] Network error during persistence for ${sessionId}:`, err.message);
    }
}

// ==========================
// WEBSOCKET LOGIC
// ==========================
io.on('connection', (socket) => {
    console.log(`🔌 [WS] New connection attempt: ${socket.id}`);

    socket.on('AUTH', (data) => {
        const { sessionId, sessionToken, videoId } = data;

        if (!sessionId || !sessionToken) {
            console.warn(`⚠️ [WS] Auth failed: Missing sessionId or token`);
            return socket.disconnect();
        }

        // Just-In-Time Session Creation
        // Since the Extension initializes the session via Next.js first, 
        // the Pulse Brain just needs to start tracking it.
        if (!secureSessions.has(sessionId)) {
            secureSessions.set(sessionId, {
                sessionId,
                sessionToken,
                videoId: videoId || "UNKNOWN",
                startTime: Date.now(),
                validSeconds: 0,
                synced: false,
                lastHeartbeat: Date.now()
            });
            console.log(`🚀 [WS] Tracking NEW session: ${sessionId}`);
        }

        const session = secureSessions.get(sessionId);

        // Update socket mapping
        socketToSession.set(socket.id, sessionId);
        session.socketId = socket.id;
        session.lastHeartbeat = Date.now();

        socket.emit('AUTH_SUCCESS');
        console.log(`✅ [WS] Session ${sessionId} Authenticated.`);
    });

    socket.on('PULSE_RESPONSE', (data) => {
        const sessionId = socketToSession.get(socket.id);
        const session = secureSessions.get(sessionId);
        if (!session) return;

        // The Brain decides: If playing, you get 8 seconds.
        if (data.isPlaying) {
            session.validSeconds += 8;
            console.log(`💓 [WS] Pulse OK for ${sessionId}. Total Time: ${session.validSeconds}s`);
        } else {
            console.log(`⏸️ [WS] Pulse Received: Video PAUSED for ${sessionId}`);
        }
        session.lastHeartbeat = Date.now();
    });

    socket.on('disconnect', () => {
        const sessionId = socketToSession.get(socket.id);
        if (sessionId) {
            console.log(`🔌 [WS] Session DISCONNECTED: ${sessionId}. Initiating sync...`);
            socketToSession.delete(socket.id);
            // Wait a small delay to handle transient disconnects? 
            // For simplicity, sync immediately or after a short timeout
            setTimeout(() => {
                const session = secureSessions.get(sessionId);
                if (session && !session.socketId) { // Still disconnected
                    syncSessionToDatabase(sessionId);
                }
            }, 2000);
        }
    });
});

// The server sends the Pulse every 8 seconds
setInterval(() => {
    io.emit('PULSE_REQUEST', { ts: Date.now() });

    // Garbage collection for stale sessions
    const now = Date.now();
    for (const [id, session] of secureSessions.entries()) {
        // If no heartbeat for 60 seconds, sync and remove
        if (now - session.lastHeartbeat > 60000 && !session.synced) {
            console.log(`🧹 [CLEANUP] Timing out dead session: ${id}`);
            syncSessionToDatabase(id);
        }
    }
}, 8000);

// ==========================
// API ENDPOINTS (Fallbacks)
// ==========================

app.post('/start-session', (req, res) => {
    // This is now primarily handled by Next.js, but kept for legacy/direct calls
    const { videoId, userId } = req.body;
    const sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;
    const sessionToken = crypto.randomBytes(32).toString('hex');

    secureSessions.set(sessionId, {
        sessionId,
        sessionToken,
        videoId,
        userId: userId || 'anonymous',
        startTime: Date.now(),
        validSeconds: 0,
        synced: false,
        lastHeartbeat: Date.now()
    });

    console.log(`🚀 [LEGACY-START] Session ${sessionId} created locally`);
    res.json({ success: true, sessionId, sessionToken });
});

app.post('/sync', (req, res) => {
    const { sessionId } = req.body;
    syncSessionToDatabase(sessionId);
    res.json({ success: true, message: "Sync triggered" });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Secure Pulse-Brain Server running on port ${PORT}`);
});
