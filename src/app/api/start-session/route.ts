// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders, createSignedResponse } from "@/lib/cors";
import admin from 'firebase-admin';
import { randomBytes } from 'crypto';

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
    const response = NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  if (!verifySignature(body)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }
  
  try {
    const { videoID, userAuthToken, extensionSecret } = body;

    if (extensionSecret !== process.env.EXTENSION_SECRET) {
      console.warn("Invalid secret received in start-session", { received: extensionSecret });
      const response = NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 });
      return addCorsHeaders(response, req);
    }

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

    const shortToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const batch = firestore.batch();

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
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
    batch.set(sessionRef, sessionDoc);
    
    const shortTokenRef = firestore.collection("short_lived_tokens").doc(shortToken);
    const tokenDoc = {
      token: shortToken,
      userId: userId, 
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
    };
    batch.set(shortTokenRef, tokenDoc);

    await batch.commit();

    return createSignedResponse({
      success: true,
      sessionToken,
      shortToken,
      expiresInSeconds: Number(process.env.SESSION_TTL_SECONDS || 7200)
    }, 200, req);
  } catch (err: any) {
    console.error("API Error: /api/start-session failed.", { error: err.message, timestamp: new Date().toISOString() });
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
