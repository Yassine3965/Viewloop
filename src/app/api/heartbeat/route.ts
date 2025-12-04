// /app/api/heartbeat/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase-admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";


export async function OPTIONS(req: Request) {
  return handleOptions();
}

export async function POST(req: Request) {

  if (!firestore) {
    console.error("Firestore not initialized - check FIREBASE_ADMIN_KEY");
    return addCorsHeaders(NextResponse.json({ error: "SERVER_NOT_READY" }, { status: 503 }));
  }

  if (req.headers.get("content-type") !== "application/json") {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 400 }));
  }

  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === "") {
      return addCorsHeaders(NextResponse.json({ error: "EMPTY_BODY" }, { status: 400 }));
    }
    const body = JSON.parse(rawBody);

    if (body.secret !== process.env.EXTENSION_SECRET) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }));
    }

    const { sessionToken, watchedSinceLastHeartbeat = 5, positionSeconds } = body;
    if (!sessionToken) return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION" }, { status: 400 }));

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const snap = await sessionRef.get();
    if (!snap.exists) return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }));

    const session = snap.data();
    if (!session || session.status !== "active") {
      return addCorsHeaders(NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 400 }));
    }

    const now = Date.now();
    const lastHb = session.lastHeartbeatAt || session.createdAt || now;
    const diffSec = Math.floor((now - lastHb) / 1000);

    const allowedInterval = Number(process.env.HEARTBEAT_ALLOWED_INTERVAL || 30);
    if (diffSec > allowedInterval * 6) {
      await sessionRef.update({ status: "suspicious", lastHeartbeatAt: now });
      return addCorsHeaders(NextResponse.json({ error: "HEARTBEAT_DELAYED", suspicious: true }, { status: 400 }));
    }

    const safeDelta = Math.max(0, Math.min( watchedSinceLastHeartbeat, 120 ));
    const newTotal = (session.totalWatchedSeconds || 0) + safeDelta;

    await sessionRef.update({
      lastHeartbeatAt: now,
      totalWatchedSeconds: newTotal,
      lastPositionSeconds: positionSeconds || session.lastPositionSeconds || 0
    });

    return addCorsHeaders(NextResponse.json({ success: true, totalWatchedSeconds: newTotal }));
  } catch (err: any) {
    if (err.name === 'SyntaxError') {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }));
    }
    // console.error("heartbeat error:", err);
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }));
  }
}
