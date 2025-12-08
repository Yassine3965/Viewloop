
// /app/api/complete/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

// Level-based point multipliers
const POINT_MULTIPLIERS: { [key: number]: number } = {
    1: 0.05, 2: 0.1, 3: 0.2, 4: 0.3, 5: 0.5
};
const GEM_RATE_PER_SECOND = 0.01;

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

  if (!verifySignature(req, body)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }

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
    const { sessionToken } = body;
    
    if (!sessionToken) {
      const response = NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const sessionSnap = await sessionRef.get();
    
    if (!sessionSnap.exists) {
      const response = NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 });
      return addCorsHeaders(response, req);
    }

    let sessionData = sessionSnap.data();
    if (!sessionData || !sessionData.userId) {
      const response = NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 });
      return addCorsHeaders(response, req);
    }

    if (sessionData.status === 'completed' || sessionData.status === 'finalized') {
        return addCorsHeaders(NextResponse.json({ success: true, points: sessionData.points, gems: sessionData.gems, message: "Session already finalized." }), req);
    }

    const now = Date.now();
    let points = 0;
    let gems = 0;
    let reputationChange = 0;
    let finalStatus = sessionData.status;

    if (sessionData.status === 'expired' || (sessionData.penaltyReasons && sessionData.penaltyReasons.includes('inactive_too_long'))) {
      finalStatus = 'suspicious';
      if (!sessionData.penaltyReasons.includes('inactive_too_long')) {
        sessionData.penaltyReasons.push('inactive_too_long');
      }
    }

    await firestore.runTransaction(async (transaction) => {
        const userRef = firestore.collection("users").doc(sessionData.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists) {
            throw new Error(`User with ID ${sessionData.userId} not found during transaction.`);
        }
        
        const userData = userSnap.data()!;
        const currentLevel = userData.level || 1;
        const pointMultiplier = POINT_MULTIPLIERS[currentLevel] || POINT_MULTIPLIERS[1];
        
        // --- POINTS CALCULATION ---
        const videoDuration = sessionData.videoDuration || 0;
        let totalWatched = Math.min(sessionData.totalWatchedSeconds || 0, videoDuration + 60*5); // Cap extra time
        
        const baseWatchedSeconds = Math.min(totalWatched, videoDuration);
        const basePoints = baseWatchedSeconds * pointMultiplier;

        const bonusSeconds = Math.max(0, totalWatched - videoDuration);
        const bonusPoints = bonusSeconds * 1.0; // 1 point per second of ad time
        
        points = (basePoints + bonusPoints);

        // --- GEMS CALCULATION ---
        const baseGems = baseWatchedSeconds * GEM_RATE_PER_SECOND;
        const adGems = (sessionData.adHeartbeats || 0) * 1; // 1 gem per ad heartbeat
        gems = baseGems + adGems;

        // --- REPUTATION & PENALTIES ---
        if (finalStatus === 'suspicious') {
          points *= 0.1; // 90% penalty for suspicious sessions
          gems *= 0.1;
          reputationChange = -0.5;
        } else {
          reputationChange = 0.1; // Reward for good behavior
        }
        
        points = Math.round(points * 100) / 100;
        gems = Math.round(gems * 100) / 100;

        const newReputation = Math.max(0, Math.min(5, (userData.reputation || 4.5) + reputationChange));
        
        transaction.update(userRef, {
            points: admin.firestore.FieldValue.increment(points),
            gems: admin.firestore.FieldValue.increment(gems),
            reputation: newReputation,
            lastUpdated: now
        });
        
        transaction.update(sessionRef, {
            status: "finalized", // A new terminal state
            points: points,
            gems: gems,
            completedAt: now,
            penaltyReasons: sessionData.penaltyReasons || [],
        });

        transaction.set(firestore.collection("watchHistory").doc(), {
            userId: sessionData.userId,
            videoId: sessionData.videoID,
            totalWatchedSeconds: sessionData.totalWatchedSeconds,
            adWatched: sessionData.adWatched || false, // keep for compatibility
            pointsEarned: points,
            gemsEarned: gems,
            completedAt: now,
            sessionToken,
            behavioralData: {
              inactiveHeartbeats: sessionData.inactiveHeartbeats,
              noMouseMovementHeartbeats: sessionData.noMouseMovementHeartbeats,
              adHeartbeats: sessionData.adHeartbeats,
              penaltyApplied: finalStatus === 'suspicious'
            }
        });
    });

    return addCorsHeaders(NextResponse.json({ 
        success: true, 
        status: finalStatus,
        points: points, 
        gems: gems,
        penaltyReasons: sessionData.penaltyReasons || []
    }), req);
    
  } catch (err: any) {
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}

    