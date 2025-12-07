// /app/api/watch-complete/route.ts
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
    const rawBody = await req.text();
    if (!rawBody) {
      return addCorsHeaders(NextResponse.json({ error: "EMPTY_BODY" }, { status: 400 }), req);
    }
    body = JSON.parse(rawBody);
  } catch (e) {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }), req);
  }

  try {
    if (body.extensionSecret !== process.env.EXTENSION_SECRET) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

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

    if (session.status === 'completed') {
        return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: 0, message: "Session already completed." }), req);
    }

    const totalWatched = session.totalWatchedSeconds || 0;
    const now = Date.now();

    let points = 0;
    if (totalWatched >= 30) points += 5;   // 5 points for 30s
    if (totalWatched >= 60) points += 10;  // 10 more for 60s (15 total)
    if (totalWatched >= 120) points += 15; // 15 more for 120s (30 total)

    await firestore.runTransaction(async (transaction) => {
        const userRef = firestore.collection("users").doc(session.userId);
        const userSnap = await transaction.get(userRef);

        if (userSnap.exists) {
            const currentPoints = userSnap.data()?.points || 0;
            transaction.update(userRef, {
                points: currentPoints + points,
                lastUpdated: now
            });
        }
        
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
    console.error("API Error: /api/watch-complete failed.", { error: err.message, body, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
