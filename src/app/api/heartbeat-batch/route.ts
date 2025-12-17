// /app/api/heartbeat-batch/route.ts - New secure heartbeat processing
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "../../../lib/cors";
import { createHmac } from 'crypto';
import { getFirestore } from '../../../lib/firebase/admin';

const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// In-memory session storage (in production, use Redis or database)
const secureSessions = new Map();
const processedSessions = new Set();

function calculatePointsSecurely(session: any) {
  // استخدام البيانات من النبضة النهائية إذا كانت متوفرة
  const validSeconds = session.finalSessionDuration !== undefined ? session.finalSessionDuration : (session.validSeconds || 0);
  const rewardSeconds = session.finalRewardTime !== undefined ? session.finalRewardTime : (session.rewardSeconds || 0);

  // استخدام الثوابت من التكوين المركزي
  const pointsConfig = {
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

    // Verify video ID matches
    if (session.videoId !== videoId) {
      const response = NextResponse.json({ error: 'Video ID mismatch' }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // Process heartbeat batch
    let validCount = 0;
    let invalidCount = 0;

    heartbeats.forEach(heartbeat => {
      if (validateHeartbeat(session, heartbeat)) {
        session.heartbeats.push(heartbeat);

        // التحقق من النبضة النهائية
        if (heartbeat.isFinal) {
          session.finalSessionDuration = heartbeat.sessionDuration;
          session.finalRewardTime = heartbeat.rewardTime;
          session.status = 'completed';
          console.log(`🏁 [FINAL-HEARTBEAT] Session ${sessionId} completed: duration=${heartbeat.sessionDuration}s, reward=${heartbeat.rewardTime}s`);
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

      // حفظ النقاط في الجلسة
      session.points = pointsAwarded.totalPoints;
      session.totalWatchedSeconds = pointsAwarded.validSeconds;
      session.rewardSeconds = pointsAwarded.rewardSeconds;
    }

    const response = NextResponse.json({
      success: true,
      processed: validCount + invalidCount,
      valid: validCount,
      invalid: invalidCount,
      pointsAwarded: pointsAwarded
    });
    return addCorsHeaders(response, req);

  } catch (err: any) {
    console.error('Heartbeat batch processing error:', err);
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}

function validateHeartbeat(session: any, heartbeat: any) {
  // Basic validation
  if (!heartbeat.timestamp || !heartbeat.videoTime) {
    return false;
  }

  // Time progression validation
  if (session.heartbeats.length > 0) {
    const lastHeartbeat = session.heartbeats[session.heartbeats.length - 1];
    const timeDiff = heartbeat.videoTime - lastHeartbeat.videoTime;

    if (heartbeat.videoPlaying && lastHeartbeat.videoPlaying) {
      if (timeDiff < 3 || timeDiff > 7) {
        return false; // Time manipulation detected
      }
    }
  }

  // Activity validation
  if (!heartbeat.tabActive) {
    return false;
  }

  if (!heartbeat.mouseActive && heartbeat.videoPlaying) {
    return false;
  }

  // Time bounds validation
  if (heartbeat.videoTime < 0 || heartbeat.videoTime > 36000) {
    return false;
  }

  return true;
}
