// /app/api/heartbeat/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";


export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;

  try {
    const admin = initializeFirebaseAdmin();
    firestore = admin.firestore;
  } catch (error: any) {
    console.error("❌ [API /api/heartbeat] Firebase Admin Init Failed", { message: error.message });
    return addCorsHeaders(NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs."
    }, { status: 503 }), req);
  }


  if (req.headers.get("content-type") !== "application/json") {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 400 }), req);
  }

  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === "") {
      return addCorsHeaders(NextResponse.json({ error: "EMPTY_BODY" }, { status: 400 }), req);
    }
    const body = JSON.parse(rawBody);

    if (body.extensionSecret !== process.env.EXTENSION_SECRET) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

    const { sessionToken, watchedSinceLastHeartbeat = 5, positionSeconds } = body;
    if (!sessionToken) return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION" }, { status: 400 }), req);

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
    if (diffSec > allowedInterval * 6) {
      await sessionRef.update({ status: "suspicious", lastHeartbeatAt: now });
      return addCorsHeaders(NextResponse.json({ error: "HEARTBEAT_DELAYED", suspicious: true }, { status: 400 }), req);
    }

    const safeDelta = Math.max(0, Math.min( watchedSinceLastHeartbeat, 120 ));
    const newTotal = (session.totalWatchedSeconds || 0) + safeDelta;

    await sessionRef.update({
      lastHeartbeatAt: now,
      totalWatchedSeconds: newTotal,
      lastPositionSeconds: positionSeconds || session.lastPositionSeconds || 0
    });

    return addCorsHeaders(NextResponse.json({ success: true, totalWatchedSeconds: newTotal }), req);
  } catch (err: any) {
    if (err.name === 'SyntaxError') {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }), req);
    }
    console.error("❌ [API /api/heartbeat] Server Error", err);
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
