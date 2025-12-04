// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { firestore, auth } from "@/lib/firebase-admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleOptions();
}

export async function POST(req: Request) {

  if (!firestore || !auth) {
    console.error("Firebase Admin not initialized - check FIREBASE_ADMIN_KEY");
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

    const { videoID, userAuthToken } = body;
    if (!videoID || !userAuthToken) {
      return addCorsHeaders(NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 }));
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(userAuthToken);
    } catch (err) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_USER_TOKEN" }, { status: 401 }));
    }

    const userId = decoded.uid;
    const now = Date.now();
    const sessionToken = `${now.toString(36)}-${Math.random().toString(36).slice(2,10)}`;

    const sessionDoc = {
      sessionToken,
      userId,
      videoID,
      createdAt: now,
      lastHeartbeatAt: now,
      totalWatchedSeconds: 0,
      adWatched: false,
      status: "active"
    };

    await firestore.collection("sessions").doc(sessionToken).set(sessionDoc);

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionToken,
      expiresInSeconds: Number(process.env.SESSION_TTL_SECONDS || 7200)
    }));
  } catch (err: any) {
    if (err.name === 'SyntaxError') {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }));
    }
    // console.error("start-session error:", err);
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }));
  }
}
