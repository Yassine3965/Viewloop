// /app/api/heartbeat-batch/route.ts - Behavioral Pattern Analysis
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "../../../lib/cors";
import { createHmac } from 'crypto';
import { getFirestore } from '../../../lib/firebase/admin';
import admin from 'firebase-admin';

const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// In-memory session storage (in production, use Redis or database)
const secureSessions = new Map();
const processedSessions = new Set();

async function processActivityUnits(session: any) {
  console.log(`🧠 [ACTIVITY-ANALYSIS] Analyzing session ${session.sessionId}`);

  // 🎯 تحليل السلوك: احصل على مدة الفيديو من قاعدة البيانات
  const db = getFirestore();
  const videoDoc = await db.collection('videos').doc(session.videoId).get();
  const videoDuration = videoDoc.exists ? (videoDoc.data()?.duration || 0) : 0;

  if (!videoDoc.exists) {
    console.warn(`❌ [POINTS] Video ${session.videoId} NOT FOUND in DB -> 0 Points`);
  } else if (videoDuration === 0) {
    console.warn(`⚠️ [POINTS] Video ${session.videoId} FOUND but Duration is 0 -> 0 Points`);
  }

  // 🎯 تحليل السلوك: احصل على أقصى وقت من النبضات
  const lastHeartbeatTime = getMaxT(session.heartbeats);

  // 🎯 تحليل السلوك: احسب الوقت الإضافي (overtime)
  const overtime = Math.max(0, lastHeartbeatTime - videoDuration);

  console.log(`🧠 [BEHAVIOR-ANALYSIS] Session ${session.sessionId}:`);
  console.log(`   Video duration: ${videoDuration}s`);
  console.log(`   Last heartbeat time: ${lastHeartbeatTime}s`);
  console.log(`   Overtime: ${overtime}s`);

  // Behavioral Analysis: Detect abnormal patterns
  const behaviorAnalysis = analyzeBehavioralPatterns(session.heartbeats);

  const activityConfig = {
    BASE_UNIT_RATE: 0.05,
    CAPACITY_RATE: 0.01,
    OFFSET_UNIT_RATE: 0.5
  };

  // Units based on heartbeats (each heartbeat represents 5s)
  const activeSeconds = session.heartbeats.length * 5;
  const validSeconds = Math.min(activeSeconds, videoDuration);
  const offsetSeconds = Math.max(0, activeSeconds - videoDuration);

  // 1. Standard Units
  const baseUnits = validSeconds * activityConfig.BASE_UNIT_RATE;

  // 2. Offset Units
  const offsetUnits = offsetSeconds * activityConfig.OFFSET_UNIT_RATE;

  // 3. Capacity (Updated Logic)
  const standardCapacity = validSeconds * 0.01;
  const offsetCapacity = offsetSeconds * 0.02;
  const capacity = standardCapacity + offsetCapacity;

  // Reputation optimization: focus on verification signal
  let reputationSignal = 0;
  const sessionCompletionRate = activeSeconds / videoDuration;

  if (offsetSeconds > 20 && sessionCompletionRate > 1.0) {
    reputationSignal = 1.0;
    console.log(`🎯 [REPUTATION-SIGNAL] High engagement detected: +${reputationSignal} reputation coefficient`);
  }

  // Final units adjustment based on behavior
  let activityPulse = baseUnits + offsetUnits;
  let systemCapacity = capacity;
  let optimizationCorrection = 0;

  if (behaviorAnalysis.suspiciousActivity) {
    optimizationCorrection = Math.floor(activityPulse * 0.5);
    activityPulse -= optimizationCorrection;
    systemCapacity = 0;
    console.log(`🚨 [ADJUSTMENT] Heuristic deviation detected. Correcting parameters.`);
  }

  return {
    baseUnits: Math.round(baseUnits * 100) / 100,
    offsetUnits: Math.round(offsetUnits * 100) / 100,
    reputationSignal: Math.round(reputationSignal * 100) / 100,
    activityPulse: Math.round(activityPulse * 100) / 100,
    systemCapacity: Math.round(systemCapacity * 100) / 100,
    validSeconds: validSeconds,
    offsetSeconds: offsetSeconds,
    videoDuration: videoDuration,
    lastHeartbeatTime: lastHeartbeatTime,
    behaviorAnalysis: behaviorAnalysis,
    optimizationCorrection: optimizationCorrection
  };
}

function getMaxT(heartbeats: any[]) {
  if (!heartbeats || heartbeats.length === 0) return 0;
  return Math.max(...heartbeats.map(h => h.t || 0));
}

function analyzeBehavioralPatterns(heartbeats: any[]) {
  // 🎯 تحليل أنماط السلوك غير الطبيعية

  let suspiciousActivity = false;
  let reasons = [];

  // 1. فحص تغييرات التركيز المفاجئة
  let focusLossCount = 0;
  let tabHiddenCount = 0;

  for (let i = 1; i < heartbeats.length; i++) {
    const prev = heartbeats[i - 1];
    const curr = heartbeats[i];

    // فقدان التركيز أثناء التشغيل
    if (prev.p && !curr.f) {
      focusLossCount++;
    }

    // إخفاء التبويب أثناء التشغيل
    if (prev.p && !curr.v) {
      tabHiddenCount++;
      suspiciousActivity = true;
      reasons.push('tab_hidden_during_playback');
    }
  }

  // 2. فحص معدلات فقدان التركيز العالية
  const focusLossRate = focusLossCount / heartbeats.length;
  if (focusLossRate > 0.3) { // أكثر من 30%
    suspiciousActivity = true;
    reasons.push('high_focus_loss_rate');
  }

  // 3. فحص إخفاء التبويب المفرط
  const tabHiddenRate = tabHiddenCount / heartbeats.length;
  if (tabHiddenRate > 0.2) { // أكثر من 20%
    suspiciousActivity = true;
    reasons.push('excessive_tab_hiding');
  }

  return {
    suspiciousActivity,
    reasons,
    focusLossCount,
    tabHiddenCount,
    totalHeartbeats: heartbeats.length,
    focusLossRate: Math.round(focusLossRate * 100) / 100,
    tabHiddenRate: Math.round(tabHiddenRate * 100) / 100
  };
}

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  // Verify signature
  const signature = req.headers.get('x-signature');
  if (!signature) {
    const response = NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 401 });
    return addCorsHeaders(response, req);
  }

  const expectedSignature = createHmac('sha256', EXTENSION_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

  if (signature !== expectedSignature) {
    const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
    return addCorsHeaders(response, req);
  }

  try {
    const { sessionId, videoId, heartbeats, timestamp } = body;

    if (!sessionId || !heartbeats || !Array.isArray(heartbeats)) {
      const response = NextResponse.json({ error: 'Invalid heartbeat batch data' }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // Create session if it doesn't exist
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

    // Process heartbeat batch with new simplified format
    let validCount = 0;
    let invalidCount = 0;

    heartbeats.forEach(heartbeat => {
      // Validate new heartbeat format (t, p, v, f, at)
      if (validateHeartbeat(heartbeat)) {
        // 🎯 تجميع النبضات مع timestamp
        session.heartbeats.push({
          t: heartbeat.t,  // time
          p: heartbeat.p,  // playing
          v: heartbeat.v,  // visibility
          f: heartbeat.f,  // focus
          at: Date.now()   // arrival time
        });

        // Check for final heartbeat (if sent)
        if (heartbeat.isFinal) {
          session.status = 'completed';
          console.log(`🏁 [SESSION-COMPLETE] Session ${sessionId} completed with ${session.heartbeats.length} heartbeats`);
        }

        validCount++;
      } else {
        invalidCount++;
        console.log(`🚨 Invalid heartbeat:`, heartbeat);
      }
    });

    session.validHeartbeats += validCount;
    session.invalidHeartbeats += invalidCount;

    console.log(`✅ Processed heartbeat batch: ${validCount} valid, ${invalidCount} invalid for session ${sessionId}`);

    // If session is completed, process activity units
    let unitsProcessed = null;
    if (session.status === 'completed') {
      unitsProcessed = await processActivityUnits(session);
      console.log(`🏆 Activity pulse calculated for session ${sessionId}: ${unitsProcessed.activityPulse} units`);

      // Update session state in memory
      session.activityPulse = unitsProcessed.activityPulse;
      session.systemCapacity = unitsProcessed.systemCapacity;
      session.reputationSignal = unitsProcessed.reputationSignal;
      session.analysis = unitsProcessed.behaviorAnalysis;
      session.offsetSeconds = unitsProcessed.offsetSeconds;

      // 💾 SAVE TO FIRESTORE (CRITICAL FIX)
      // We must save the results to the database and update the user's balance.
      try {
        const db = getFirestore();
        const sessionRef = db.collection('sessions').doc(sessionId);

        // 1. Update Session
        await sessionRef.set({
          status: 'completed',
          activityPulse: unitsProcessed.activityPulse,
          systemCapacity: unitsProcessed.systemCapacity,
          validSeconds: unitsProcessed.validSeconds,
          offsetSeconds: unitsProcessed.offsetSeconds,
          completedAt: Date.now(),
          processed: true,
          finalState: unitsProcessed
        }, { merge: true });

        // 2. Update User Balance (if userId is available)
        // We need to fetch the userId from the session doc (since in-memory might not have it if restarted)
        // OR rely on what we have. heartbeat-batch creates session with minimal info.
        // Let's fetch the session doc to get the userId.
        const sessionDoc = await sessionRef.get();
        if (sessionDoc.exists) {
          const userId = sessionDoc.data()?.userId;
          if (userId && userId !== 'anonymous') {
            const userRef = db.collection('users').doc(userId);
            // Feedback type based on activity (completion vs partial)
            const feedbackType = unitsProcessed.activityPulse >= 0.8 ? 'completion' : 'partial';

            await userRef.set({
              activityPulse: admin.firestore.FieldValue.increment(unitsProcessed.activityPulse),
              systemCapacity: admin.firestore.FieldValue.increment(unitsProcessed.systemCapacity),
              reputation: admin.firestore.FieldValue.increment(unitsProcessed.reputationSignal),
              totalTimeWatched: admin.firestore.FieldValue.increment(unitsProcessed.validSeconds + unitsProcessed.offsetSeconds),
              lastSessionStatus: {
                type: feedbackType,
                activityPulse: unitsProcessed.activityPulse,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
              }
            }, { merge: true });
            console.log(`👤 [DB] Updated user ${userId} state: +${unitsProcessed.activityPulse} pulse, +${unitsProcessed.systemCapacity} capacity`);
          } else {
            console.log(`⚠️ [DB] Anonymous user or no userId, skipping balance update.`);
          }
        }

      } catch (dbError) {
        console.error(`❌ [DB] Failed to save completion data:`, dbError);
      }

      // منع إعادة المعالجة
      processedSessions.add(sessionId);
    }

    const response = NextResponse.json({
      success: true,
      processed: validCount + invalidCount,
      valid: validCount,
      invalid: invalidCount,
      activityPulse: unitsProcessed,
      sessionStatus: session.status
    });
    return addCorsHeaders(response, req);

  } catch (err: any) {
    console.error('Heartbeat batch processing error:', err);
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}

function validateHeartbeat(heartbeat: any) {
  // Validate new simplified heartbeat format
  if (typeof heartbeat.t !== 'number' || heartbeat.t < 0) {
    return false; // Invalid time
  }

  if (typeof heartbeat.p !== 'boolean') {
    return false; // Invalid playing state
  }

  if (typeof heartbeat.v !== 'boolean') {
    return false; // Invalid visibility state
  }

  if (typeof heartbeat.f !== 'boolean') {
    return false; // Invalid focus state
  }

  // Time bounds check
  if (heartbeat.t > 36000) { // Max 10 hours
    return false;
  }

  return true;
}
