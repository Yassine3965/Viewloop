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

    const { sessionToken, watchedSinceLastHeartbeat = 5 } = body;
    if (!sessionToken) return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 }), req);

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const snap = await sessionRef.get();
    if (!snap.exists) return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }), req);

    const session = snap.data();
    if (!session || session.status !== "active") {
      return addCorsHeaders(NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 400 }), req);
    }

    const now = Date.now();
    const lastHb = session.lastHeartbeatAt || session.createdAt || now;
    const diffSec = Math.floor((now - lastHb) / 1000);

    const allowedInterval = Number(process.env.HEARTBEAT_ALLOWED_INTERVAL || 30);
    if (diffSec > allowedInterval * 6) { // if heartbeat is delayed by 6 intervals
      await sessionRef.update({ status: "suspicious", lastHeartbeatAt: now });
      return addCorsHeaders(NextResponse.json({ error: "HEARTBEAT_DELAYED", suspicious: true }, { status: 400 }), req);
    }
    
    // Increment total watched seconds safely
    const safeDelta = Math.max(0, Math.min( watchedSinceLastHeartbeat, 120 )); // Cap delta to prevent abuse
    const newTotal = (session.totalWatchedSeconds || 0) + safeDelta;

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
