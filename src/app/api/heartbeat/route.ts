// /app/api/heartbeat/route.ts
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
    firestore = adminApp.firestore();
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
  
  try {
    const { sessionToken } = body;
    if (!sessionToken) {
      const response = NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      const response = NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 });
      return addCorsHeaders(response, req);
    }

    const sessionData = sessionSnap.data();
    if (!sessionData) {
      const response = NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 });
      return addCorsHeaders(response, req);
    }
    
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
    
    // Increment should be based on the heartbeat interval to prevent cheating
    const safeIncrement = Math.max(0, Math.min(secondsSinceLast, 20)); // Cap increment to 20s

    const newTotal = (sessionData.totalWatchedSeconds || 0) + safeIncrement;

    await sessionRef.update({
      lastHeartbeatAt: now,
      totalWatchedSeconds: newTotal
    });
    
    // The "lite" extension doesn't need a signed response or a complex body.
    return addCorsHeaders(NextResponse.json({ success: true, totalWatchedSeconds: newTotal }), req);

  } catch (err: any) {
    console.error("API Error: /api/heartbeat failed.", { error: err.message, timestamp: new Date().toISOString() });
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
