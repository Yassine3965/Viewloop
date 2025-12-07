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
    if (!sessionToken) return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 }), req);

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const snap = await sessionRef.get();
    if (!snap.exists) return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }), req);

    const sessionData = snap.data();
    if (!sessionData) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 }), req);
    }
    
    // ⭐ Verify the stored secret
    if (sessionData.extensionSecret !== process.env.EXTENSION_SECRET) {
      console.warn("Heartbeat failed: Invalid secret in session doc", { sessionToken });
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

    if (sessionData.status !== "active") {
      return addCorsHeaders(NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 400 }), req);
    }

    const now = Date.now();
    const lastHeartbeatMs = sessionData.lastHeartbeatAt || sessionData.createdAt || now;
    
    const secondsSinceLast = Math.floor((now - lastHeartbeatMs) / 1000);
    
    const safeIncrement = Math.max(0, Math.min(secondsSinceLast, 20)); // Cap increment to 20s to prevent abuse

    const newTotal = (sessionData.totalWatchedSeconds || 0) + safeIncrement;

    await sessionRef.update({
      lastHeartbeatAt: now,
      totalWatchedSeconds: newTotal
    });

    return addCorsHeaders(NextResponse.json({ success: true, totalWatchedSeconds: newTotal }), req);
  } catch (err: any) {
    console.error("API Error: /api/heartbeat failed.", { error: err.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
