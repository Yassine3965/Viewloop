
// /app/api/complete/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore;
  } catch (error: any) {
    console.error("API Error: Firebase Admin initialization failed.", { message: error.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 }), req);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }), req);
  }

  try {
    const { sessionToken } = body;
    
    if (!sessionToken) {
      return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 }), req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const sessionSnap = await sessionRef.get();
    
    if (!sessionSnap.exists) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }), req);
    }

    const sessionData = sessionSnap.data();
    if (!sessionData || !sessionData.userId) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 }), req);
    }

    if (sessionData.extensionSecret !== process.env.EXTENSION_SECRET) {
      console.warn("Watch-complete failed: Invalid secret in session doc", { sessionToken });
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

    if (sessionData.status === 'completed') {
        return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: 0, message: "Session already completed." }), req);
    }

    const totalWatched = sessionData.totalWatchedSeconds || 0;
    const now = Date.now();

    let points = Math.floor(totalWatched * 0.05);

    const MAX_POINTS_PER_VIDEO = 50;
    points = Math.min(points, MAX_POINTS_PER_VIDEO);

    await firestore.runTransaction(async (transaction) => {
        const userRef = firestore.collection("users").doc(sessionData.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists) {
            throw new Error(`User with ID ${sessionData.userId} not found during transaction.`);
        }
        
        const currentPoints = userSnap.data()?.points || 0;
        const newTotalPoints = currentPoints + points;

        transaction.update(userRef, {
            points: newTotalPoints,
            lastUpdated: now
        });
        
        transaction.update(sessionRef, {
            status: "completed",
            points: points,
            completedAt: now,
        });

        transaction.set(firestore.collection("watchHistory").doc(), {
            userId: sessionData.userId,
            videoId: sessionData.videoID,
            totalWatchedSeconds: totalWatched,
            adWatched: sessionData.adWatched || false,
            pointsEarned: points,
            completedAt: now,
            sessionToken
        });
    });

    return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: points }), req);
    
  } catch (err: any) {
    console.error("API Error: /api/complete failed.", { error: err.message, body, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
