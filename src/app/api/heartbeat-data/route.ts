
// /app/api/heartbeat-data/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

const HEARTBEAT_INTERVAL_SEC = 15;

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

  // Signature verification is temporarily disabled for debugging.
  // Re-enable this in production.
  /*
  if (!verifySignature(req, body)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }
  */

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
  } catch (error: any) {
    const response = NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }
  
  try {
    const { sessionToken, tabIsActive, adIsPresent, currentTime } = body;
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
    
    const updates: { [key: string]: any } = {
      lastHeartbeatAt: now,
    };

    // --- Merge data from extension and web page ---
    if (tabIsActive === false) {
      updates.inactiveHeartbeats = admin.firestore.FieldValue.increment(1);
    } else {
        // Reset counter when tab becomes active again.
        if (sessionData.inactiveHeartbeats > 0) {
            updates.inactiveHeartbeats = 0;
        }
    }

    if (adIsPresent === true) {
      updates.adHeartbeats = admin.firestore.FieldValue.increment(1);
    }
    
    // --- Determine Watched Time ---
    // Trust the currentTime from the extension as the source of truth.
    let newTotalWatchedSeconds = currentTime !== undefined ? currentTime : (sessionData.totalWatchedSeconds || 0);
    updates.totalWatchedSeconds = newTotalWatchedSeconds;
    
    // --- Update Status based on behavior ---
    const newInactiveHeartbeats = tabIsActive === false ? (sessionData.inactiveHeartbeats || 0) + 1 : 0;

    if (newInactiveHeartbeats >= 6) { // ~90 seconds of inactivity
        updates.status = 'expired';
        if (!sessionData.penaltyReasons || !sessionData.penaltyReasons.includes('inactive_too_long')) {
            updates.penaltyReasons = admin.firestore.FieldValue.arrayUnion('inactive_too_long');
        }
    }

    // --- The self-healing completion logic ---
    const videoDuration = sessionData.videoDuration;
    if (videoDuration && newTotalWatchedSeconds >= videoDuration) {
        updates.status = 'completed';
    }
    // --- End of self-healing logic ---


    await sessionRef.update(updates);
    
    return addCorsHeaders(NextResponse.json({ 
        success: true, 
        totalWatchedSeconds: newTotalWatchedSeconds,
        status: updates.status || sessionData.status,
        adHeartbeats: (sessionData.adHeartbeats || 0) + (adIsPresent ? 1 : 0)
    }), req);

  } catch (err: any) {
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
