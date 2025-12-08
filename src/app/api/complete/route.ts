// /app/api/complete/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

// Constants for behavioral analysis
const MAX_INACTIVE_HEARTBEAT_RATIO = 0.3; // 30% of heartbeats can be inactive
const MAX_NO_MOUSE_MOVEMENT_RATIO = 0.5; // 50% of heartbeats can have no mouse movement

// Level-based point multipliers
const POINT_MULTIPLIERS: { [key: number]: number } = {
    1: 0.05, // Level 1 (Basic)
    2: 0.1,  // Level 2
    3: 0.2,  // Level 3
    4: 0.3,  // Level 4
    5: 0.5   // Level 5
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

    const sessionData = sessionSnap.data();
    if (!sessionData || !sessionData.userId) {
      const response = NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 });
      return addCorsHeaders(response, req);
    }

    if (sessionData.status === 'completed') {
        return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: 0, gemsAdded: 0, message: "Session already completed." }), req);
    }

    const totalWatched = sessionData.totalWatchedSeconds || 0;
    const now = Date.now();

    let points = 0;
    let gems = 0;
    let reputationChange = 0;

    await firestore.runTransaction(async (transaction) => {
        const userRef = firestore.collection("users").doc(sessionData.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists) {
            throw new Error(`User with ID ${sessionData.userId} not found during transaction.`);
        }
        
        const userData = userSnap.data()!;
        const currentLevel = userData.level || 1;
        const pointMultiplier = POINT_MULTIPLIERS[currentLevel] || POINT_MULTIPLIERS[1];
        
        // Behavioral Analysis
        const totalHeartbeats = Math.floor(totalWatched / 15); // Approximate number of heartbeats
        const inactiveRatio = totalHeartbeats > 0 ? (sessionData.inactiveHeartbeats || 0) / totalHeartbeats : 0;
        const noMouseRatio = totalHeartbeats > 0 ? (sessionData.noMouseMovementHeartbeats || 0) / totalHeartbeats : 0;

        let pointsPenalty = 0;
        let penaltyReason: string[] = [];

        if (totalHeartbeats > 2 && inactiveRatio > MAX_INACTIVE_HEARTBEAT_RATIO) {
            pointsPenalty += 0.5; // 50% penalty
            penaltyReason.push('High inactivity');
            reputationChange -= 0.2;
        }
        if (totalHeartbeats > 2 && noMouseRatio > MAX_NO_MOUSE_MOVEMENT_RATIO) {
            pointsPenalty += 0.5; // 50% penalty
            penaltyReason.push('No mouse movement');
            reputationChange -= 0.3;
        }

        // Calculate base points and gems
        points = Math.floor(totalWatched * pointMultiplier);
        gems = totalWatched * GEM_RATE_PER_SECOND;

        // Apply penalty
        if (pointsPenalty > 0) {
            points = Math.floor(points * (1 - Math.min(pointsPenalty, 1)));
            console.warn(`Points penalty applied for session ${sessionToken}. Reason: ${penaltyReason.join(', ')}`);
            reputationChange -= 0.5;
        } else {
            // Reward for good behavior
            reputationChange += 0.1;
        }
        
        const MAX_POINTS_PER_VIDEO = 50;
        points = Math.min(points, MAX_POINTS_PER_VIDEO);
        
        const newReputation = Math.max(0, Math.min(5, (userData.reputation || 4.5) + reputationChange));
        
        transaction.update(userRef, {
            points: admin.firestore.FieldValue.increment(points),
            gems: admin.firestore.FieldValue.increment(gems),
            reputation: newReputation,
            lastUpdated: now
        });
        
        transaction.update(sessionRef, {
            status: "completed",
            points: points,
            gems: gems,
            completedAt: now,
            penaltyReasons: penaltyReason,
        });

        transaction.set(firestore.collection("watchHistory").doc(), {
            userId: sessionData.userId,
            videoId: sessionData.videoID,
            totalWatchedSeconds: totalWatched,
            adWatched: sessionData.adWatched || false,
            pointsEarned: points,
            gemsEarned: gems,
            completedAt: now,
            sessionToken,
            behavioralData: {
              inactiveRatio,
              noMouseRatio,
              penaltyApplied: pointsPenalty > 0
            }
        });
    });

    return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: points, gemsAdded: gems }), req);
    
  } catch (err: any) {
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
