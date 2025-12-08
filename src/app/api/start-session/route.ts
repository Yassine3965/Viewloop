// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;
  let auth: admin.auth.Auth;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  // Signature verification is temporarily disabled for debugging, but should be re-enabled.
  // if (!verifySignature(req, body)) {
  //     const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
  //     return addCorsHeaders(response, req);
  // }

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
    auth = adminApp.auth();
  } catch (error: any) {
    const response = NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }
  
  try {
    const { videoID, userAuthToken } = body;

    if (!videoID || !userAuthToken) {
      const response = NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
      return addCorsHeaders(response, req);
    }
    
    // --- التحقق من الفيديو ---
    const videoRef = firestore.collection("videos").doc(videoID);
    const videoSnap = await videoRef.get();
    if (!videoSnap.exists) {
        console.warn(`Attempt to start session for non-existent video: ${videoID}`);
        const response = NextResponse.json({ success: false, error: "VIDEO_NOT_FOUND" }, { status: 404 });
        return addCorsHeaders(response, req);
    }
    // --- نهاية التحقق ---

    let decoded;
    try {
      decoded = await auth.verifyIdToken(userAuthToken);
    } catch (err) {
      console.error("Token verification failed:", err);
      const response = NextResponse.json({ error: "INVALID_USER_TOKEN" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    const userId = decoded.uid;
    const now = Date.now();

    // Prevent re-watching completed videos
    const watchHistoryQuery = await firestore.collection("watchHistory")
        .where('userId', '==', userId)
        .where('videoId', '==', videoID)
        .limit(1)
        .get();

    if (!watchHistoryQuery.empty) {
        const response = NextResponse.json({ 
            success: false, 
            error: "VIDEO_ALREADY_WATCHED",
            message: "You have already watched this video and received points for it."
        }, { status: 409 });
        return addCorsHeaders(response, req);
    }
    
    // Invalidate any other existing sessions for this user
    const sessionsRef = firestore.collection("sessions");
    const activeSessionQuery = await sessionsRef.where('userId', '==', userId).where('status', '==', 'active').get();

    if (!activeSessionQuery.empty) {
        const batch = firestore.batch();
        activeSessionQuery.docs.forEach(doc => {
            batch.update(doc.ref, { status: 'expired', completedAt: now });
        });
        await batch.commit();
        console.log(`Expired ${activeSessionQuery.size} old session(s) for user ${userId}`);
    }
    
    const sessionToken = uuidv4();

    const sessionDoc = {
      sessionToken,
      userId,
      videoID,
      createdAt: now,
      lastHeartbeatAt: now,
      totalWatchedSeconds: 0,
      adWatched: false,
      status: "active",
      inactiveHeartbeats: 0,
      noMouseMovementHeartbeats: 0,
      adHeartbeats: 0,
      penaltyReasons: []
    };
    
    await firestore.collection("sessions").doc(sessionToken).set(sessionDoc);

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionToken,
    }), req);

  } catch (err: any) {
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
