// /app/api/heartbeat/route.ts
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

  const requestBody = await req.text();
  const signature = req.headers.get('X-HMAC-Signature');

  if (!verifySignature(requestBody, signature)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }

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
    body = JSON.parse(requestBody);
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }
  
  try {
    const { sessionToken, mouseMoved, tabIsActive, adIsPresent } = body;
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

    const updates: admin.firestore.UpdateData = {
      lastHeartbeatAt: now,
      totalWatchedSeconds: newTotal
    };

    // Update behavioral counters
    if (tabIsActive === false) {
      updates.inactiveHeartbeats = admin.firestore.FieldValue.increment(1);
    }
    if (mouseMoved === false) {
      updates.noMouseMovementHeartbeats = admin.firestore.FieldValue.increment(1);
    }
    if (adIsPresent === true) {
      updates.adHeartbeats = admin.firestore.FieldValue.increment(1);
    }


    await sessionRef.update(updates);
    
    return addCorsHeaders(NextResponse.json({ success: true, totalWatchedSeconds: newTotal }), req);

  } catch (err: any) {
    console.error("API Error: /api/heartbeat failed.", { error: err.message, timestamp: new Date().toISOString() });
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
