// /app/api/process-activity/route.ts - Activity and pulse processing
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "../../../lib/cors";
import { createHmac, createHash } from 'crypto';
import { getFirestore } from "@/lib/firebase/admin";
import admin from 'firebase-admin';

// Use Firestore as the source of truth for session state

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

  try {
    const { sessionId, videoId, sessionData } = body;

    if (!sessionId) {
      const response = NextResponse.json({ error: 'MISSING_SESSION_ID' }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // Get session from Firestore
    const firestore = getFirestore();
    const sessionRef = firestore.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.exists ? sessionSnap.data() : null;
    if (!session) {
      const response = NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return addCorsHeaders(response, req);
    }

    // Verify session token
    if (!session.sessionToken) {
      const response = NextResponse.json({ error: "INVALID_SESSION" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    // Verify signature with session token
    const signature = req.headers.get('x-signature');
    if (!signature) {
      const response = NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    const sortedKeys = Object.keys(body).sort();
    const sortedBody: Record<string, any> = {};
    sortedKeys.forEach(key => {
      sortedBody[key] = body[key];
    });
    const dataString = JSON.stringify(sortedBody);
    const combined = dataString + session.sessionToken;
    const expectedSignature = createHash('sha256')
      .update(combined)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.log('Signature mismatch:', { received: signature, expected: expectedSignature });
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    // Verify session status before processing
    if (session.status !== 'active') {
      return addCorsHeaders(
        NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 400 }),
        req
      );
    }

    if (session.processed === true) {
      return addCorsHeaders(
        NextResponse.json({ error: "SESSION_ALREADY_PROCESSED" }, { status: 409 }),
        req
      );
    }

    // Calculate final points using secure server-side logic
    // We prioritize validSeconds passed in the body by our WebSocket server
    const pulseSeconds = body.sessionData?.validSeconds;
    if (pulseSeconds !== undefined) {
      console.log(`📡 [API] Using pulse-based validSeconds: ${pulseSeconds}`);
      await sessionRef.update({ validSeconds: pulseSeconds });
      session.validSeconds = pulseSeconds;
    }

    const { activityPulse, systemCapacity, reputationDelta, validSeconds, extraSeconds, qualityMessage } = processActivityUnits(session);

    // Update session indicators and reputation in database
    if (session.userId && session.userId !== 'anonymous') {
      try {
        const userRef = firestore.collection("users").doc(session.userId);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
          const userData = userSnap.data();
          const currentPulse = userData?.activityPulse || userData?.points || 0;
          const currentCapacity = userData?.systemCapacity || userData?.gems || 0;
          const currentReputation = userData?.reputation || 4.5;
          const newTotalPulse = currentPulse + activityPulse;
          const newTotalCapacity = currentCapacity + systemCapacity;

          const newReputation = Math.max(0, Math.min(5, currentReputation + reputationDelta));

          await userRef.update({
            activityPulse: newTotalPulse,
            systemCapacity: newTotalCapacity,
            reputation: newReputation,
            lastUpdated: Date.now(),
            totalSessions: (userData?.totalSessions || 0) + 1,
            totalWatchTime: (userData?.totalWatchTime || 0) + validSeconds,
            lastSessionStatus: {
              type: session.completedAt ? 'completion' : 'partial',
              activityPulse: activityPulse,
              qualityMessage: qualityMessage,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            }
          });

          console.log(`✅ Activity synchronization complete for ${session.userId}`);
        } else {
          // Create user if doesn't exist (start with neutral reputation)
          const initialReputation = 4.5;
          await userRef.set({
            activityPulse: activityPulse,
            systemCapacity: systemCapacity,
            reputation: initialReputation,
            lastUpdated: Date.now(),
            totalSessions: 1,
            totalWatchTime: validSeconds,
            createdAt: Date.now()
          });
        }

        // Add to activity logs
        await firestore.collection("activityLogs").add({
          userId: session.userId,
          videoId: session.videoId,
          sessionId: sessionId,
          activityPulse: activityPulse,
          systemCapacity: systemCapacity,
          reputationDelta: reputationDelta,
          validSeconds: validSeconds,
          extraSeconds: extraSeconds,
          completedAt: Date.now()
        });

      } catch (userUpdateError) {
        console.error('Error updating user data:', userUpdateError);
        // Continue with session update even if user update fails
      }
    }

    // Save final status to session
    const finalActivity = {
      activityPulse,
      systemCapacity,
      reputationDelta,
      validSeconds,
      extraSeconds,
      qualityMessage
    };

    session.finalActivity = finalActivity;
    session.processed = true;
    session.completedAt = Date.now();

    // Update session status and invalidate token
    await sessionRef.update({
      status: 'completed',
      finalActivity: finalActivity,
      processed: true,
      completedAt: Date.now(),
      sessionToken: null
    });

    const response = NextResponse.json({
      success: true,
      qualityMessage: finalActivity.qualityMessage,
      syncState: "PROCESSED",
      sessionId: sessionId
    });
    return addCorsHeaders(response, req);

  } catch (err: any) {
    console.error('Calculate points error:', err);
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}

function processActivityUnits(session: any) {
  const validSeconds = session.validSeconds || 0;
  const videoDuration = session.videoDuration || 0;

  const standardSeconds = Math.min(validSeconds, videoDuration);
  const extraSeconds = Math.max(0, validSeconds - videoDuration);

  // 1. Base Activity Pulse: 1 unit per 30 seconds
  const basePulse = standardSeconds / 30;

  // 2. Extended Activity: 2 units per 30 seconds
  const extendedPulse = (extraSeconds / 30) * 2;

  // 3. System Capacity Growth
  const capacity = (validSeconds / 30) * 0.1;

  const reputationDelta = extraSeconds > 60 ? +0.02 : 0;

  const activityPulse = basePulse + extendedPulse;

  // Determine feedback message
  let qualityMessage = "نشاط مستقر";
  if (extraSeconds > 0) qualityMessage = "نشاط جيد";
  if (extraSeconds > 120) qualityMessage = "نشاط ممتاز";

  return {
    activityPulse: Math.round(activityPulse * 100) / 100,
    systemCapacity: Math.round(capacity * 100) / 100,
    reputationDelta,
    validSeconds,
    extraSeconds,
    qualityMessage
  };
}
