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
    const snap = await sessionRef.get();
    
    if (!snap.exists) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }), req);
    }

    const session = snap.data();
    if (!session || !session.userId) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 }), req);
    }

    if (session.extensionSecret !== process.env.EXTENSION_SECRET) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

    if (session.status === 'completed') {
        return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: 0, message: "Session already completed." }), req);
    }

    const totalWatched = session.totalWatchedSeconds || 0;
    const now = Date.now();

    let points = 0;
    if (totalWatched >= 30) points += 5;
    if (totalWatched >= 60) points += 10;
    if (totalWatched >= 120) points += 15;

    await firestore.runTransaction(async (transaction) => {
        const userRef = firestore.collection("users").doc(session.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists) {
            throw new Error(`User with ID ${session.userId} not found during transaction.`);
        }
        
        const currentPoints = userSnap.data()?.points || 0;
        const newTotalPoints = currentPoints + points;

        transaction.update(userRef, {
            points: newTotalPoints,
            lastUpdated: now
        });
        
        transaction.update(sessionRef, {
            status: "completed",
            points,
            completedAt: now,
        });

        transaction.set(firestore.collection("watchHistory").doc(), {
            userId: session.userId,
            videoId: session.videoID,
            totalWatchedSeconds: totalWatched,
            adWatched: session.adWatched || false,
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
