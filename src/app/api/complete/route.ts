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
    if (body.extensionSecret !== process.env.EXTENSION_SECRET) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

    const { sessionToken, videoDuration: finalDelta = 0, adWatched = false } = body;
    
    if (!sessionToken) {
      return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION" }, { status: 400 }), req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const snap = await sessionRef.get();
    
    if (!snap.exists) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }), req);
    }

    const session = snap.data();
    if (!session) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 }), req);
    }

    const totalWatched = (session.totalWatchedSeconds || 0) + Math.max(0, Math.min(finalDelta, 600));
    const now = Date.now();

    let points = 0;
    if (totalWatched >= 30) points += 5;
    if (totalWatched >= 60) points += 10;
    if (totalWatched >= 120) points += 15;
    if (adWatched === true && !session.adWatched) points += 20;

    await firestore.collection("watchHistory").add({
      userId: session.userId,
      videoId: session.videoID,
      totalWatchedSeconds: totalWatched,
      adWatched,
      pointsEarned: points,
      completedAt: now,
      sessionToken
    });

    const userRef = firestore.collection("users").doc(session.userId);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      const userData = userSnap.data();
      if(userData){
        await userRef.update({
          points: (userData.points || 0) + points,
          lastUpdated: now
        });
      }
    } else {
      await userRef.set({
        points,
        createdAt: now,
        lastUpdated: now
      });
    }

    await sessionRef.update({
      status: "completed",
      totalWatchedSeconds: totalWatched,
      adWatched,
      completedAt: now,
      points
    });

    return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: points }), req);
    
  } catch (err: any) {
    console.error("API Error: /api/complete failed.", { error: err.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
