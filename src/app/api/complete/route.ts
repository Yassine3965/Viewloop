
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
const AD_BONUS_RATE_PER_SECOND = 0.5; // 0.5 points per second of ad time

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
    const { sessionToken } = body;
    
    if (!sessionToken) {
      const response = NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    
    let points = 0;
    let gems = 0;
    let reputationChange = 0;
    let finalStatus = 'completed'; // Default to completed
    let sessionData: admin.firestore.DocumentData | undefined;
    let penaltyReasons: string[] = [];

    await firestore.runTransaction(async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        
        if (!sessionSnap.exists) {
          throw new Error("INVALID_SESSION");
        }

        sessionData = sessionSnap.data();
        if (!sessionData || !sessionData.userId) {
          throw new Error("INVALID_SESSION_DATA");
        }

        if (sessionData.status === 'finalized') {
            // If already finalized, just return existing data and exit.
            points = sessionData.points || 0;
            gems = sessionData.gems || 0;
            finalStatus = sessionData.status;
            penaltyReasons = sessionData.penaltyReasons || [];
            return; // Exit transaction early, no writes needed.
        }
        
        finalStatus = sessionData.status;
        penaltyReasons = sessionData.penaltyReasons || [];
        
        const now = Date.now();

        // Check for expired status set by heartbeat logic
        if (sessionData.status === 'expired') {
            finalStatus = 'suspicious';
            if (!penaltyReasons.includes('inactive_too_long')) {
                penaltyReasons.push('inactive_too_long');
            }
        }
        
        const userRef = firestore.collection("users").doc(sessionData.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists) {
            throw new Error(`User with ID ${sessionData.userId} not found during transaction.`);
        }
        
        const userData = userSnap.data()!;
        const currentLevel = userData.level || 1;
        const pointMultiplier = POINT_MULTIPLIERS[currentLevel] || POINT_MULTIPLIERS[1];
        
        // --- POINTS CALCULATION ---
        // totalWatchedSeconds is the source of truth for time spent.
        const totalWatched = sessionData.totalWatchedSeconds || 0;
        
        // No distinction between base and bonus time anymore, just reward for time spent.
        points = totalWatched * pointMultiplier;

        // --- GEMS CALCULATION ---
        const baseGems = totalWatched * GEM_RATE_PER_SECOND;
        const adGems = (sessionData.adHeartbeats || 0) * 1; // 1 gem per ad heartbeat
        gems = baseGems + adGems;

        // --- REPUTATION & PENALTIES ---
        if (finalStatus === 'suspicious') {
          // Only apply penalty if the session was flagged as suspicious
          points *= 0.1; // 90% penalty
          gems *= 0.1;
          reputationChange = -0.5;
        } else {
          // Otherwise, it's a good session, even if incomplete.
          reputationChange = 0.1; // Reward for good behavior
          finalStatus = 'completed'; // Mark as completed for our records
        }
        
        points = Math.round(points * 100) / 100;
        gems = Math.round(gems * 100) / 100;

        const newReputation = Math.max(0, Math.min(5, (userData.reputation || 4.5) + reputationChange));
        
        // Only update user if there are points or gems to add
        if (points > 0 || gems > 0) {
            transaction.update(userRef, {
                points: admin.firestore.FieldValue.increment(points),
                gems: admin.firestore.FieldValue.increment(gems),
                reputation: newReputation,
                lastUpdated: now
            });
        }
        
        // Always finalize the session to prevent re-processing
        transaction.update(sessionRef, {
            status: "finalized", // A new terminal state
            points: points,
            gems: gems,
            completedAt: now,
            penaltyReasons: penaltyReasons,
        });

        // Log the activity to watchHistory
        transaction.set(firestore.collection("watchHistory").doc(), {
            userId: sessionData.userId,
            videoId: sessionData.videoID,
            totalWatchedSeconds: sessionData.totalWatchedSeconds,
            adWatched: sessionData.adWatched || false,
            pointsEarned: points,
            gemsEarned: gems,
            completedAt: now,
            sessionToken,
            behavioralData: {
              inactiveHeartbeats: sessionData.inactiveHeartbeats || 0,
              noMouseMovementHeartbeats: sessionData.noMouseMovementHeartbeats || 0,
              adHeartbeats: sessionData.adHeartbeats || 0,
              penaltyApplied: finalStatus === 'suspicious'
            }
        });
    });

    // Handle case where session was already finalized
    if (sessionData?.status === 'finalized') {
         return addCorsHeaders(NextResponse.json({ success: true, points: sessionData.points, gems: sessionData.gems, status: sessionData.status, penaltyReasons: sessionData.penaltyReasons, message: "Session already finalized." }), req);
    }
    
    return addCorsHeaders(NextResponse.json({ 
        success: true, 
        status: finalStatus,
        points: points, 
        gems: gems,
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
