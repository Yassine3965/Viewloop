
// /app/api/complete/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

// Level-based activity multipliers
const ACTIVITY_MULTIPLIERS: { [key: number]: number } = {
  1: 0.05, 2: 0.1, 3: 0.2, 4: 0.3, 5: 0.5
};
const CAPACITY_RATE_PER_SECOND = 0.01;
const OFFSET_BONUS_RATE_PER_SECOND = 0.5;

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  // Signature verification is disabled for this endpoint to allow client-side closing
  /*
  if (!verifySignature(req, body)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }
  */

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
  } catch (error: any) {
    const response = NextResponse.json({
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  try {
    const { sessionId } = body;

    console.log('Complete called with sessionId:', sessionId);

    if (!sessionId) {
      const response = NextResponse.json({ error: "MISSING_SESSION_ID" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionId);

    let activityPulse = 0;
    let systemCapacity = 0;
    let reputationChange = 0;
    let finalStatus = 'completed';
    let sessionData: admin.firestore.DocumentData | undefined;
    let penaltyReasons: string[] = [];
    let qualityMessage = "";

    await firestore.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);

      if (!sessionSnap.exists) {
        throw new Error("INVALID_SESSION");
      }

      sessionData = sessionSnap.data();

      console.log('Session data:', sessionData);

      if (!sessionData || !sessionData.userId) {
        throw new Error("INVALID_SESSION_DATA");
      }

      // If already finalized, just return existing data and exit.
      if (sessionData.status === 'finalized') {
        activityPulse = sessionData.activityPulse || 0;
        systemCapacity = sessionData.systemCapacity || 0;
        finalStatus = sessionData.status;
        penaltyReasons = sessionData.penaltyReasons || [];
        console.log('Session already finalized, returning existing data');
        return;
      }

      // This is the core logic change.
      // We now process the session regardless of its status ('active', 'completed', 'expired').
      // The final state is determined here.
      finalStatus = sessionData.status;
      penaltyReasons = sessionData.penaltyReasons || [];

      const now = Date.now();

      // Check for expired status set by heartbeat logic or other server processes
      if (sessionData.status === 'expired') {
        finalStatus = 'suspicious';
        if (!penaltyReasons.includes('inactive_too_long')) {
          penaltyReasons.push('inactive_too_long');
        }
      }

      let userData: any = null;
      let currentLevel = 1;
      let activityMultiplier = ACTIVITY_MULTIPLIERS[1];

      if (sessionData.userId !== 'anonymous') {
        const userRef = firestore.collection("users").doc(sessionData.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists) {
          throw new Error(`User with ID ${sessionData.userId} not found during transaction.`);
        }

        userData = userSnap.data()!;
        currentLevel = userData.level || 1;
        activityMultiplier = ACTIVITY_MULTIPLIERS[currentLevel] || ACTIVITY_MULTIPLIERS[1];
      }

      // --- ACTIVITY CALCULATION (30s Units Logic) ---
      const validSeconds = sessionData.validSeconds || sessionData.totalWatchedSeconds || 0;
      const videoDuration = sessionData.videoDuration || 0;

      const standardSeconds = Math.min(validSeconds, videoDuration);
      const offsetSeconds = Math.max(0, validSeconds - videoDuration);

      // 1. Standard Units: 1 unit per 30 seconds
      activityPulse = standardSeconds / 30;
      // 2. Offset Units: 2 units per 30 seconds
      activityPulse += (offsetSeconds / 30) * 2;

      // System Capacity
      systemCapacity = (validSeconds / 30) * 0.1;

      // --- REPUTATION & PENALTIES ---
      if (finalStatus === 'suspicious') {
        activityPulse *= 0.1;
        systemCapacity *= 0.1;
        reputationChange = -0.5;
      } else {
        reputationChange = offsetSeconds > 60 ? 0.02 : 0.01;
        finalStatus = 'completed';
      }

      // Quality Message
      qualityMessage = "Stable Activity";
      if (offsetSeconds > 0) qualityMessage = "Good Activity";
      if (offsetSeconds > 120) qualityMessage = "Excellent Activity";

      activityPulse = Math.round(activityPulse * 100) / 100;
      systemCapacity = Math.round(systemCapacity * 100) / 100;

      // Update user's activity and capacity
      if (activityPulse > 0 || systemCapacity > 0) {
        if (sessionData.userId !== 'anonymous') {
          const newReputation = Math.max(0, Math.min(5, (userData!.reputation || 4.5) + reputationChange));
          transaction.update(firestore.collection("users").doc(sessionData.userId), {
            activityPulse: admin.firestore.FieldValue.increment(activityPulse),
            systemCapacity: admin.firestore.FieldValue.increment(systemCapacity),
            reputation: newReputation,
            lastUpdated: now,
            lastSessionStatus: {
              type: 'completion',
              qualityMessage: qualityMessage,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            }
          });
        }
      }

      // Finalize session
      transaction.update(sessionRef, {
        status: "finalized",
        activityPulse: activityPulse,
        systemCapacity: systemCapacity,
        qualityMessage: qualityMessage,
        completedAt: now,
        penaltyReasons: penaltyReasons,
      });

      // Log activity to watchHistory
      transaction.set(firestore.collection("watchHistory").doc(), {
        userId: sessionData.userId,
        videoId: sessionData.videoId,  // Fixed: videoId instead of videoID
        totalWatchedSeconds: sessionData.validSeconds || 0,
        adWatched: sessionData.adWatched || false,
        activityPulse: activityPulse,
        systemCapacity: systemCapacity,
        completedAt: now,
        sessionId: sessionId,
        behavioralData: {
          inactiveHeartbeats: sessionData.inactiveHeartbeats || 0,
          adHeartbeats: sessionData.adHeartbeats || 0,
          penaltyApplied: finalStatus === 'suspicious'
        }
      });
    });

    if (sessionData?.status === 'finalized') {
      console.log('Returning already finalized session');
      return addCorsHeaders(NextResponse.json({
        success: true,
        activityPulse: sessionData.activityPulse,
        systemCapacity: sessionData.systemCapacity,
        status: "finalized",
        penaltyReasons: sessionData.penaltyReasons,
        message: "Session was already finalized."
      }), req);
    }

    console.log('Returning success with activityPulse:', activityPulse, 'status:', finalStatus);

    return addCorsHeaders(NextResponse.json({
      success: true,
      status: finalStatus,
      activityPulse: activityPulse,
      systemCapacity: systemCapacity,
      qualityMessage: qualityMessage,
      penaltyReasons: penaltyReasons
    }), req);

  } catch (err: any) {
    let errorMessage = "SERVER_ERROR";
    if (err.message === "INVALID_SESSION" || err.message === "INVALID_SESSION_DATA") {
      errorMessage = err.message;
    }
    const response = NextResponse.json({ error: errorMessage, details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
