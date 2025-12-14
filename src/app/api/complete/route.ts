
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

        // If already finalized, just return existing data and exit.
        if (sessionData.status === 'finalized') {
            points = sessionData.points || 0;
            gems = sessionData.gems || 0;
            finalStatus = sessionData.status; // a bit redundant but safe
            penaltyReasons = sessionData.penaltyReasons || [];
            return; // Exit transaction early, no writes needed.
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
        
        const userRef = firestore.collection("users").doc(sessionData.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists) {
            throw new Error(`User with ID ${sessionData.userId} not found during transaction.`);
        }
        
        const userData = userSnap.data()!;
        const currentLevel = userData.level || 1;
        const pointMultiplier = POINT_MULTIPLIERS[currentLevel] || POINT_MULTIPLIERS[1];
        
        // --- POINTS CALCULATION ---
        const totalWatched = sessionData.validSeconds || sessionData.totalWatchedSeconds || 0;
        points = totalWatched * pointMultiplier;

        // --- GEMS CALCULATION ---
        const baseGems = totalWatched * GEM_RATE_PER_SECOND;
        // Gems from ad time
        const adSeconds = sessionData.adSeconds || 0;
        const adGems = adSeconds * 0.1; // 0.1 gem per second of ad
        gems = baseGems + adGems;

        // --- REPUTATION & PENALTIES ---
        // Apply penalties ONLY if the session was flagged as suspicious
        if (finalStatus === 'suspicious') {
          points *= 0.1; // 90% penalty
          gems *= 0.1;   // 90% penalty
          reputationChange = -0.5; // Significant reputation hit
        } else {
          // It's a good session, reward good behavior
          reputationChange = 0.1; 
          // If it was just 'active', we now consider it 'completed' for our records.
          finalStatus = 'completed'; 
        }
        
        points = Math.round(points * 100) / 100;
        gems = Math.round(gems * 100) / 100;

        const newReputation = Math.max(0, Math.min(5, (userData.reputation || 4.5) + reputationChange));
        
        // Update user's points, gems, and reputation
        if (points > 0 || gems > 0) {
            transaction.update(userRef, {
                points: admin.firestore.FieldValue.increment(points),
                gems: admin.firestore.FieldValue.increment(gems),
                reputation: newReputation,
                lastUpdated: now
            });
        }
        
        // Always finalize the session to prevent re-processing. This is critical.
        transaction.update(sessionRef, {
            status: "finalized", // A new terminal state that indicates processing is done.
            points: points,
            gems: gems,
            completedAt: now,
            penaltyReasons: penaltyReasons,
        });

        // Log the activity to watchHistory for analytics
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
              adHeartbeats: sessionData.adHeartbeats || 0,
              penaltyApplied: finalStatus === 'suspicious'
            }
        });
    });

    // This handles the case where the transaction was for an already finalized session.
    if (sessionData?.status === 'finalized') {
         return addCorsHeaders(NextResponse.json({ success: true, points: sessionData.points, gems: sessionData.gems, status: "finalized", penaltyReasons: sessionData.penaltyReasons, message: "Session was already finalized." }), req);
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
