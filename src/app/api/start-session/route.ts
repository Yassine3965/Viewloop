// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;
  let auth: admin.auth.Auth;

  const requestBody = await req.text();
  const signature = req.headers.get('X-Signature');

  if (!verifySignature(requestBody, signature)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
    auth = adminApp.auth();
  } catch (error: any) {
    console.error("API Error: Firebase Admin initialization failed.", { message: error.message, timestamp: new Date().toISOString() });
    const response = NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  let body;
  try {
    body = JSON.parse(requestBody);
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }
  
  try {
    const { videoID, userAuthToken } = body;

    if (!videoID || !userAuthToken) {
      const response = NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(userAuthToken);
    } catch (err) {
      const response = NextResponse.json({ error: "INVALID_USER_TOKEN" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    const userId = decoded.uid;
    const now = Date.now();
    
    const sessionsRef = firestore.collection("sessions");
    const activeSessionQuery = await sessionsRef.where('userId', '==', userId).where('status', '==', 'active').limit(1).get();

    if (!activeSessionQuery.empty) {
        const oldSessionDoc = activeSessionQuery.docs[0];
        await oldSessionDoc.ref.update({ status: 'expired', completedAt: now });
        console.warn(`User ${userId} has an old active session. Expiring it and starting a new one.`);
    }
    
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
    };
    
    await firestore.collection("sessions").doc(sessionToken).set(sessionDoc);

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionToken,
    }), req);

  } catch (err: any) {
    console.error("API Error: /api/start-session failed.", { error: err.message, timestamp: new Date().toISOString() });
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
