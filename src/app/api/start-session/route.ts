
// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import admin from 'firebase-admin';

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";

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

  let auth: admin.auth.Auth;

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
    auth = adminApp.auth();
  } catch (error: any) {
    console.error("Firebase Admin initialization failed.", { message: error.message });
    const response = NextResponse.json({
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  try {
    const { videoID, userAuthToken } = body;

    if (!videoID || !userAuthToken) {
      const response = NextResponse.json({ error: "MISSING_VIDEO_ID_OR_TOKEN" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(userAuthToken);
    } catch (err) {
      const response = NextResponse.json({ error: "INVALID_USER_TOKEN" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    const userId = decoded.uid;

    // التحقق من صحة videoID (يجب أن يكون 11 حرفاً)
    if (videoID.length !== 11) {
      const response = NextResponse.json({ error: "INVALID_VIDEO_ID" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // إنشاء sessionId
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // إنشاء الجلسة في Firebase
    const sessionData = {
      sessionId: sessionId,
      userId: userId,
      videoID: videoID,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      totalWatchedSeconds: 0,
      validSeconds: 0,
      adSeconds: 0,
      points: 0,
      gems: 0
    };

    await firestore.collection('sessions').doc(sessionId).set(sessionData);

    console.log('Created session:', sessionId);

    // إضافة بيانات الفيديو
    const videoData = {
      id: videoID,
      url: `https://www.youtube.com/watch?v=${videoID}`,
      duration: 300, // افتراضي
      title: `Video ${videoID}`,
      thumbnail: `https://img.youtube.com/vi/${videoID}/maxresdefault.jpg`
    };

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionId: sessionId,
      video: videoData
    }), req);

  } catch (err: any) {
    console.error(`[SERVER_ERROR] in /api/start-session:`, err.message);
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
