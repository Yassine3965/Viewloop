// =====================================================
//      VIEWLOOP SESSION INFRASTRUCTURE SERVER
// =====================================================

const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: process.env.ALLOWED_ORIGINS || "*", methods: ["GET", "POST"] }
});

app.use(express.json());
app.use(require('cors')({ origin: process.env.ALLOWED_ORIGINS || "*" }));

const NEXTJS_API_URL = process.env.NEXTJS_API_URL || "https://viewloop.vercel.app";

// ==========================
// SESSION STATE MACHINE
// ==========================
class SessionStateMachine {
    constructor() {
        this.states = {
            INIT: 'INIT',
            ACTIVE: 'ACTIVE',
            PAUSED: 'PAUSED',
            COMPLETED: 'COMPLETED',
            FINALIZED: 'FINALIZED'
        };
        this.transitions = {
            [this.states.INIT]: [this.states.ACTIVE],
            [this.states.ACTIVE]: [this.states.PAUSED, this.states.COMPLETED],
            [this.states.PAUSED]: [this.states.ACTIVE, this.states.COMPLETED],
            [this.states.COMPLETED]: [this.states.FINALIZED],
            [this.states.FINALIZED]: []
        };
    }

    canTransition(from, to) {
        return this.transitions[from]?.includes(to) || false;
    }
}

// ==========================
// SECURITY MANAGER
// ==========================
class SecurityManager {
    constructor() {
        this.usedTokens = new Set();
        this.connectionFingerprints = new Map();
    }

    generateFingerprint(socket) {
        const ip = socket.handshake.address;
        const ua = socket.handshake.headers['user-agent'];
        return crypto.createHash('sha256')
            .update(`${ip}:${ua}`)
            .digest('hex')
            .substring(0, 16);
    }

    validateAuth(data, socket) {
        const { sessionId, sessionToken } = data;
        if (!sessionId || !sessionToken || typeof sessionId !== 'string' || typeof sessionToken !== 'string') {
            return { valid: false, reason: 'Invalid auth parameters' };
        }

        if (this.usedTokens.has(sessionToken)) {
            return { valid: false, reason: 'Token reuse detected' };
        }

        return { valid: true };
    }

    trackConnection(socket, sessionId) {
        const fingerprint = this.generateFingerprint(socket);
        this.connectionFingerprints.set(sessionId, fingerprint);
    }

    validateConnection(socket, sessionId) {
        const currentFingerprint = this.generateFingerprint(socket);
        const storedFingerprint = this.connectionFingerprints.get(sessionId);
        return currentFingerprint === storedFingerprint;
    }

    invalidateToken(sessionToken) {
        this.usedTokens.add(sessionToken);
    }
}

// ==========================
// TIME MANAGER
// ==========================
class TimeManager {
    constructor() {
        this.MAX_CYCLE_DURATION = 15000; // 15 seconds max per cycle
        this.MIN_CYCLE_DURATION = 5000;  // 5 seconds min per cycle
    }

    calculateValidTime(lastValidPulseAt, currentTimestamp, observedDuration) {
        const actualDuration = Math.min(currentTimestamp - lastValidPulseAt, this.MAX_CYCLE_DURATION);
        return Math.max(0, Math.min(actualDuration / 1000, observedDuration / 1000));
    }

    getJitteredInterval() {
        // Random interval between MIN and MAX with jitter
        const range = this.MAX_CYCLE_DURATION - this.MIN_CYCLE_DURATION;
        return this.MIN_CYCLE_DURATION + Math.random() * range;
    }
}

// ==========================
// VALIDATION MANAGER
// ==========================
class ValidationManager {
    constructor(timeManager) {
        this.timeManager = timeManager;
        this.pendingValidations = new Map();
        this.validationSequence = new Map();
    }

    requestValidation(sessionId, socket) {
        const sequenceId = crypto.randomBytes(8).toString('hex');
        const requestTime = Date.now();

        this.pendingValidations.set(sequenceId, {
            sessionId,
            requestTime,
            socketId: socket.id
        });

        socket.emit('VALIDATION_REQUEST', {
            sequenceId,
            timestamp: requestTime
        });

        return sequenceId;
    }

    validateResponse(sequenceId, response, session) {
        const validation = this.pendingValidations.get(sequenceId);
        if (!validation) {
            return { valid: false, reason: 'Unknown validation sequence' };
        }

        const responseTime = Date.now();
        const responseDelay = responseTime - validation.requestTime;

        // 🔧 IMPROVEMENT: Harden timing checks to prevent fake responses and race conditions
        if (responseDelay < 100 || responseDelay > this.timeManager.MAX_CYCLE_DURATION + 2000) {
            this.pendingValidations.delete(sequenceId);
            return { valid: false, reason: 'Timing anomaly' };
        }

        // 🔧 IMPROVEMENT: Strengthen state consistency to prevent desynchronization
        const isPlaying = response.isPlaying;
        const isTabActive = response.isTabActive;
        const isEnded = response.isEnded;

        if ((session.state === 'COMPLETED' && !isEnded) ||
            (session.state === 'ACTIVE' && !isPlaying) ||
            (session.state === 'PAUSED' && isPlaying)) {
            this.pendingValidations.delete(sequenceId);
            return { valid: false, reason: 'State mismatch' };
        }

        const validTime = this.timeManager.calculateValidTime(
            session.lastValidPulseAt || validation.requestTime,
            responseTime,
            response.observedDuration || 0
        );

        this.pendingValidations.delete(sequenceId);
        return { valid: true, validTime, responseTime };
    }
}

// ==========================
// SYNC MANAGER
// ==========================
class SyncManager {
    constructor() {
        this.syncStates = {
            ACTIVE: 'ACTIVE',
            SYNCING: 'SYNCING',
            SYNCED: 'SYNCED',
            FAILED: 'FAILED'
        };
        this.retryAttempts = new Map();
        this.MAX_RETRIES = 3;
    }

    async syncSession(session) {
        // 🔧 IMPROVEMENT: Guarantee exactly one sync execution with lock
        if (session.syncLock) return;
        session.syncLock = true;

        if (session.syncState === this.syncStates.SYNCING) {
            session.syncLock = false;
            return;
        }

        session.syncState = this.syncStates.SYNCING;

        try {
            const body = {
                sessionId: session.sessionId,
                videoId: session.videoId || "UNKNOWN",
                sessionData: { validSeconds: session.accumulatedValidTime }
            };

            const sortedKeys = Object.keys(body).sort();
            const sortedBody = {};
            sortedKeys.forEach(k => sortedBody[k] = body[k]);
            const dataString = JSON.stringify(sortedBody);
            const combined = dataString + session.sessionToken;
            const signature = crypto.createHash('sha256').update(combined).digest('hex');

            // 🔧 IMPROVEMENT: Use AbortController for Node.js compatible timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${NEXTJS_API_URL}/api/process-activity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature': signature
                },
                body: dataString,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const result = await response.json();

            if (response.ok) {
                session.syncState = this.syncStates.SYNCED;
                this.retryAttempts.delete(session.sessionId);
                // Invalidate token only after successful sync
                sessionManager.securityManager.invalidateToken(session.sessionToken);
                console.log(`[SYNC] Success: ${session.sessionId}`);
                session.syncLock = false;
                return true;
            } else {
                console.error(`[SYNC] Failed: ${session.sessionId}, ${result.error}`);
                throw new Error(result.error || 'Sync failed');
            }
        } catch (err) {
            console.error(`[SYNC] Error: ${session.sessionId}, ${err.message}`);
            session.syncState = this.syncStates.FAILED;
            const attempts = this.retryAttempts.get(session.sessionId) || 0;
            if (attempts < this.MAX_RETRIES) {
                this.retryAttempts.set(session.sessionId, attempts + 1);
                setTimeout(() => this.syncSession(session), Math.pow(2, attempts) * 1000);
            }
            session.syncLock = false;
            return false;
        }
    }

    canDeleteSession(session) {
        return session.syncState === this.syncStates.SYNCED;
    }
}

// ==========================
// SESSION MANAGER
// ==========================
class SessionManager {
    constructor(stateMachine, securityManager, timeManager, validationManager, syncManager) {
        this.stateMachine = stateMachine;
        this.securityManager = securityManager;
        this.timeManager = timeManager;
        this.validationManager = validationManager;
        this.syncManager = syncManager;
        this.sessions = new Map();
        this.socketToSession = new Map();
        this.cleanupInterval = null;
    }

    createSession(sessionId, sessionToken, videoId, socket) {
        const session = {
            sessionId,
            sessionToken,
            videoId: videoId || "UNKNOWN",
            state: this.stateMachine.states.INIT,
            startTime: Date.now(),
            accumulatedValidTime: 0,
            lastValidPulseAt: null,
            syncState: this.syncManager.syncStates.ACTIVE,
            socketId: socket.id,
            createdAt: Date.now(),
            finalized: false,  // Flag to prevent double time calculation
            syncLock: false  // 🔧 IMPROVEMENT: Prevent race conditions in sync
        };

        this.sessions.set(sessionId, session);
        this.socketToSession.set(socket.id, sessionId);
        this.securityManager.trackConnection(socket, sessionId);

        return session;
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    updateSessionState(sessionId, newState) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        // 🔧 IMPROVEMENT: Strengthen state consistency - prevent transitions during active sync
        if (session.syncState === this.syncManager.syncStates.SYNCING) {
            console.warn(`[STATE] Cannot transition ${sessionId} during sync`);
            return false;
        }

        if (!this.stateMachine.canTransition(session.state, newState)) {
            return false;
        }

        session.state = newState;

        // Force sync on COMPLETED to ensure points are calculated
        if (newState === this.stateMachine.states.COMPLETED && !session.finalized) {
            // Calculate final remaining time before sync (prevent double count)
            const now = Date.now();
            const referenceTime = session.lastValidPulseAt || session.startTime;  // Support early disconnect
            const remainingTime = Math.min((now - referenceTime) / 1000, this.timeManager.MAX_CYCLE_DURATION / 1000);
            session.accumulatedValidTime += remainingTime;
            session.finalized = true;  // Prevent double calculation
            console.log(`[SESSION] Finalized time for ${sessionId}: +${remainingTime.toFixed(2)}s`);
            this.syncManager.syncSession(session);
        }

        return true;
    }

    accumulateValidTime(sessionId, validTime, timestamp) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.accumulatedValidTime += validTime;
        session.lastValidPulseAt = timestamp;
    }

    handleDisconnect(socketId) {
        const sessionId = this.socketToSession.get(socketId);
        if (!sessionId) return;

        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.socketId = null;
        this.socketToSession.delete(socketId);

        // 🔧 IMPROVEMENT: Improve disconnect reliability with detailed logging and cleanup
        console.log(`[DISCONNECT] Session ${sessionId} disconnected from socket ${socketId}`);

        // Clean up pending validations for this socket
        for (const [seqId, validation] of this.validationManager.pendingValidations.entries()) {
            if (validation.socketId === socketId) {
                this.validationManager.pendingValidations.delete(seqId);
            }
        }

        // On disconnect, if ACTIVE or PAUSED, transition to COMPLETED and sync immediately
        if (session.state === this.stateMachine.states.ACTIVE || session.state === this.stateMachine.states.PAUSED) {
            this.updateSessionState(sessionId, this.stateMachine.states.COMPLETED);
        } else {
            // For other states, sync immediately if not already syncing
            this.syncManager.syncSession(session);
        }
    }

    cleanupStaleSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            // Remove sessions that have been disconnected for too long and synced
            if (!session.socketId && (now - (session.lastValidPulseAt || session.createdAt) > 300000)) {
                if (this.syncManager.canDeleteSession(session)) {
                    // 🔧 IMPROVEMENT: Improve memory safety - clean up all references
                    this.sessions.delete(sessionId);
                    this.securityManager.connectionFingerprints.delete(sessionId);
                    this.syncManager.retryAttempts.delete(sessionId);
                    // Remove any remaining socket mappings if exist
                    if (session.socketId && this.socketToSession.has(session.socketId)) {
                        this.socketToSession.delete(session.socketId);
                    }
                    console.log(`[CLEANUP] Removed stale session: ${sessionId}`);
                    // Token already invalidated in syncSession on success
                } else if (session.syncState === this.syncManager.syncStates.ACTIVE || session.syncState === this.syncManager.syncStates.FAILED) {
                    // Force final sync before potential deletion
                    this.syncManager.syncSession(session);
                }
            }
        }
    }

    startCleanup() {
        this.cleanupInterval = setInterval(() => this.cleanupStaleSessions(), 60000);
    }
}

// ==========================
// MAIN SERVER LOGIC
// ==========================
const stateMachine = new SessionStateMachine();
const securityManager = new SecurityManager();
const timeManager = new TimeManager();
const validationManager = new ValidationManager(timeManager);
const syncManager = new SyncManager();
const sessionManager = new SessionManager(stateMachine, securityManager, timeManager, validationManager, syncManager);

// ==========================
// WEBSOCKET HANDLERS
// ==========================
io.on('connection', (socket) => {
    console.log(`[WS] Connection: ${socket.id}`);

    socket.on('AUTH', (data) => {
        const authResult = securityManager.validateAuth(data, socket);
        if (!authResult.valid) {
            console.warn(`[WS] Auth failed: ${authResult.reason}`);
            socket.emit('AUTH_FAILED', { reason: authResult.reason });
            return socket.disconnect();
        }

        const { sessionId, sessionToken, videoId } = data;
        let session = sessionManager.getSession(sessionId);

        if (!session) {
            session = sessionManager.createSession(sessionId, sessionToken, videoId, socket);
            console.log(`[WS] New session: ${sessionId}`);
        } else {
            // Reconnection validation
            if (!securityManager.validateConnection(socket, sessionId)) {
                console.warn(`[WS] Connection fingerprint mismatch: ${sessionId}`);
                socket.emit('AUTH_FAILED', { reason: 'Connection validation failed' });
                return socket.disconnect();
            }
            session.socketId = socket.id;
            sessionManager.socketToSession.set(socket.id, sessionId);
        }

        sessionManager.updateSessionState(sessionId, stateMachine.states.ACTIVE);
        socket.emit('AUTH_SUCCESS');
        console.log(`[WS] Auth success: ${sessionId}`);
    });

    socket.on('VALIDATION_RESPONSE', (data) => {
        const sessionId = sessionManager.socketToSession.get(socket.id);
        const session = sessionManager.getSession(sessionId);
        if (!session) return;

        const validationResult = validationManager.validateResponse(data.sequenceId, data, session);
        if (validationResult.valid) {
            sessionManager.accumulateValidTime(sessionId, validationResult.validTime, validationResult.responseTime);
            console.log(`[WS] Validation passed: ${sessionId}, +${validationResult.validTime.toFixed(2)}s`);
        } else {
            console.log(`[WS] Validation failed: ${sessionId}, ${validationResult.reason}`);
        }
    });

    socket.on('STATE_UPDATE', (data) => {
        const sessionId = sessionManager.socketToSession.get(socket.id);
        const session = sessionManager.getSession(sessionId);
        if (!session) return;

        const { isPlaying, isEnded } = data;
        let newState;

        if (isEnded) {
            newState = stateMachine.states.COMPLETED;
        } else if (isPlaying) {
            newState = stateMachine.states.ACTIVE;
        } else {
            newState = stateMachine.states.PAUSED;
        }

        if (sessionManager.updateSessionState(sessionId, newState)) {
            console.log(`[WS] State updated: ${sessionId} -> ${newState}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[WS] Disconnect: ${socket.id}`);
        sessionManager.handleDisconnect(socket.id);
    });
});

// ==========================
// VALIDATION CYCLE SCHEDULER
// ==========================
function scheduleValidationCycle() {
    const interval = timeManager.getJitteredInterval();

    setTimeout(() => {
        // Request validation from all active sessions
        for (const [sessionId, session] of sessionManager.sessions.entries()) {
            if (session.state === stateMachine.states.ACTIVE && session.socketId) {
                const socket = io.sockets.sockets.get(session.socketId);
                if (socket) {
                    validationManager.requestValidation(sessionId, socket);
                }
            }
        }

        // Schedule next cycle
        scheduleValidationCycle();
    }, interval);
}

// Start validation cycles
scheduleValidationCycle();
sessionManager.startCleanup();

// ==========================
// API ENDPOINTS
// ==========================
app.post('/start-session', (req, res) => {
    const { videoId, userId } = req.body;
    const sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;
    const sessionToken = crypto.randomBytes(32).toString('hex');

    const session = sessionManager.createSession(sessionId, sessionToken, videoId, { id: null });
    sessionManager.updateSessionState(sessionId, stateMachine.states.INIT);

    console.log(`[API] Session created: ${sessionId}`);
    res.json({ success: true, sessionId, sessionToken });
});

app.post('/sync', (req, res) => {
    const { sessionId } = req.body;
    const session = sessionManager.getSession(sessionId);
    if (session) {
        syncManager.syncSession(session);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Session Infrastructure Server running on port ${PORT}`);
});
