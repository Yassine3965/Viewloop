// /app/api/start-session/route.ts
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
  let auth: admin.auth.Auth;

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore;
    auth = adminApp.auth;
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
    const { videoID, userAuthToken, extensionSecret } = body;

    if (extensionSecret !== process.env.EXTENSION_SECRET) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

    if (!videoID || !userAuthToken) {
      return addCorsHeaders(NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 }), req);
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(userAuthToken);
    } catch (err) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_USER_TOKEN" }, { status: 401 }), req);
    }

    const userId = decoded.uid;
    const now = Date.now();
    const sessionToken = `${now.toString(36)}-${Math.random().toString(36).slice(2,10)}`;

    const sessionDoc = {
      sessionToken,
      userId,
      videoID,
      createdAt: now,
      lastHeartbeatAt: now,
      totalWatchedSeconds: 0,
      adWatched: false,
      status: "active",
      extensionSecret: extensionSecret,
    };

    await firestore.collection("sessions").doc(sessionToken).set(sessionDoc);

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionToken,
      expiresInSeconds: Number(process.env.SESSION_TTL_SECONDS || 7200)
    }), req);
  } catch (err: any) {
    console.error("API Error: /api/start-session failed.", { error: err.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
