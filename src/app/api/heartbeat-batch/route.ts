// /app/api/heartbeat-batch/route.ts - Behavioral Pattern Analysis
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "../../../lib/cors";
import { createHmac } from 'crypto';
import { getFirestore } from '../../../lib/firebase/admin';

const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// In-memory session storage (in production, use Redis or database)
const secureSessions = new Map();
const processedSessions = new Set();

async function calculatePointsSecurely(session: any) {
  console.log(`🧠 [BEHAVIOR-ANALYSIS] Analyzing session ${session.sessionId}`);

  // 🎯 تحليل السلوك: احصل على مدة الفيديو من قاعدة البيانات
  const db = getFirestore();
  const videoDoc = await db.collection('videos').doc(session.videoId).get();
  const videoDuration = videoDoc.exists ? (videoDoc.data()?.duration || 0) : 0;

  // 🎯 تحليل السلوك: احصل على أقصى وقت من النبضات
  const lastHeartbeatTime = getMaxT(session.heartbeats);

  // 🎯 تحليل السلوك: احسب الوقت الإضافي (overtime)
  const overtime = Math.max(0, lastHeartbeatTime - videoDuration);

  console.log(`🧠 [BEHAVIOR-ANALYSIS] Session ${session.sessionId}:`);
  console.log(`   Video duration: ${videoDuration}s`);
  console.log(`   Last heartbeat time: ${lastHeartbeatTime}s`);
  console.log(`   Overtime: ${overtime}s`);

  // 🎯 تحليل السلوك: كشف الأنماط غير الطبيعية
  const behaviorAnalysis = analyzeBehavioralPatterns(session.heartbeats);

  // استخدام الثوابت من التكوين المركزي
  const pointsConfig = {
    VIDEO_POINTS_PER_SECOND: 0.05,
    VIDEO_INITIAL_SECONDS: 5,
    REWARD_POINTS_PER_SECOND: 0.5
  };

  // حساب النقاط الأساسية
  const validSeconds = Math.min(lastHeartbeatTime, videoDuration); // لا تتجاوز مدة الفيديو
  const videoWatchSeconds = Math.max(0, validSeconds - pointsConfig.VIDEO_INITIAL_SECONDS);
  const videoPoints = videoWatchSeconds * pointsConfig.VIDEO_POINTS_PER_SECOND;

  // 🎯 منطق Reward الذكي: تعزيز السمعة بدلاً من النقاط المباشرة
  let rewardSignal = 0;
  const sessionCompletionRate = session.heartbeats.length / (videoDuration / 5); // نسبة إكمال الجلسة

  if (overtime > 20 && sessionCompletionRate > 0.7) {
    // جلسة طويلة + التزام = إشارة Reward
    rewardSignal = Math.min(overtime / 10, 5); // حد أقصى 5 نقاط سمعة
    console.log(`🎯 [REWARD-SIGNAL] Long committed session: +${rewardSignal} reputation points`);
  }

  // لا نقاط مكافآت مباشرة - فقط إشارة Reward لتعزيز السمعة
  const rewardPoints = 0; // لا نقاط إضافية مباشرة

  // 🎯 تحليل السلوك: تعديل النقاط بناءً على السلوك
  let finalPoints = videoPoints + rewardPoints;
  let penalty = 0;

  if (behaviorAnalysis.suspiciousActivity) {
    penalty = Math.floor(finalPoints * 0.5); // خصم 50% للنشاط المشبوه
    finalPoints -= penalty;
    console.log(`🚨 [PENALTY] Suspicious activity detected: -${penalty} points`);
  }

  return {
    videoPoints: Math.round(videoPoints * 100) / 100,
    rewardSignal: Math.round(rewardSignal * 100) / 100,  // إشارة Reward لتعزيز السمعة
    totalPoints: Math.round(finalPoints * 100) / 100,
    validSeconds: validSeconds,
    rewardSeconds: overtime,
    videoDuration: videoDuration,
    lastHeartbeatTime: lastHeartbeatTime,
    overtime: overtime,
    behaviorAnalysis: behaviorAnalysis,
    penalty: penalty
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
    const prev = heartbeats[i-1];
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

    // إذا اكتملت الجلسة، قم بتحليل السلوك وحساب النقاط
    let pointsAwarded = null;
    if (session.status === 'completed') {
      pointsAwarded = await calculatePointsSecurely(session);
      console.log(`🏆 Points calculated for session ${sessionId}: ${pointsAwarded.totalPoints} points`);

      // حفظ النتائج في الجلسة
      session.points = pointsAwarded.totalPoints;
      session.rewardSignal = pointsAwarded.rewardSignal;  // 🎯 حفظ إشارة Reward للسمعة
      session.analysis = pointsAwarded.behaviorAnalysis;
      session.overtime = pointsAwarded.overtime;

      // منع إعادة المعالجة
      processedSessions.add(sessionId);
    }

    const response = NextResponse.json({
      success: true,
      processed: validCount + invalidCount,
      valid: validCount,
      invalid: invalidCount,
      pointsAwarded: pointsAwarded,
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
