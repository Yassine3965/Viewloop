// /app/api/heartbeat/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders, createSignedResponse } from "@/lib/cors";
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
    const { sessionToken, shortToken } = body;
    if (!sessionToken || !shortToken) {
      const response = NextResponse.json({ error: "MISSING_TOKENS" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const shortTokenRef = firestore.collection("short_lived_tokens").doc(shortToken);

    const [sessionSnap, shortTokenSnap] = await Promise.all([
      sessionRef.get(),
      shortTokenRef.get()
    ]);

    if (!sessionSnap.exists) {
      const response = NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 });
      return addCorsHeaders(response, req);
    }

    const sessionData = sessionSnap.data();
    if (!sessionData) {
      const response = NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 });
      return addCorsHeaders(response, req);
    }
    
    if (!shortTokenSnap.exists) {
      console.warn("Heartbeat failed: Invalid short-lived token", { sessionToken });
      const response = NextResponse.json({ error: "INVALID_SHORT_TOKEN" }, { status: 403 });
      return addCorsHeaders(response, req);
    }

    const shortTokenData = shortTokenSnap.data();
    if (!shortTokenData || shortTokenData.expiresAt.toDate() < new Date()) {
      console.warn("Heartbeat failed: Expired short-lived token", { sessionToken });
      await shortTokenRef.delete();
      const response = NextResponse.json({ error: "EXPIRED_SHORT_TOKEN" }, { status: 403 });
      return addCorsHeaders(response, req);
    }

    if (shortTokenData.userId !== sessionData.userId) {
      console.error("CRITICAL: Short token user does not match session user.", {
        sessionToken,
        shortTokenUserId: shortTokenData.userId,
        sessionUserId: sessionData.userId,
      });
      await shortTokenRef.delete();
      const response = NextResponse.json({ error: "TOKEN_USER_MISMATCH" }, { status: 403 });
      return addCorsHeaders(response, req);
    }

    await shortTokenRef.delete();
    
    if (sessionData.extensionSecret !== process.env.EXTENSION_SECRET) {
      console.warn("Heartbeat failed: Invalid secret in session doc", { sessionToken });
      const response = NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 });
      return addCorsHeaders(response, req);
    }

    if (sessionData.status !== "active") {
      const response = NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    const now = Date.now();
    const lastHeartbeatMs = sessionData.lastHeartbeatAt || sessionData.createdAt || now;
    
    const secondsSinceLast = Math.floor((now - lastHeartbeatMs) / 1000);
    
    const safeIncrement = Math.max(0, Math.min(secondsSinceLast, 20));

    const newTotal = (sessionData.totalWatchedSeconds || 0) + safeIncrement;

    await sessionRef.update({
      lastHeartbeatAt: now,
      totalWatchedSeconds: newTotal
    });

    return createSignedResponse({ success: true, totalWatchedSeconds: newTotal }, 200, req);
  } catch (err: any) {
    console.error("API Error: /api/heartbeat failed.", { error: err.message, timestamp: new Date().toISOString() });
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
