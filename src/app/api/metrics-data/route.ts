// /app/api/metrics-data/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifySignature, initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from "firebase-admin";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let body: any;

  // 1️⃣ Parse JSON
  try {
    body = await req.json();
  } catch {
    const response = NextResponse.json(
      { error: "INVALID_JSON" },
      { status: 400 }
    );
    return addCorsHeaders(response, req);
  }

  // 2️⃣ Basic validation
  const { sessionId, heartbeats } = body;

  if (!sessionId || !Array.isArray(heartbeats)) {
    const response = NextResponse.json(
      { error: "INVALID_PAYLOAD" },
      { status: 400 }
    );
    return addCorsHeaders(response, req);
  }

  // 3️⃣ Signature verification
  if (!verifySignature(req, body)) {
    const response = NextResponse.json(
      { error: "INVALID_SIGNATURE" },
      { status: 403 }
    );
    return addCorsHeaders(response, req);
  }

  // 4️⃣ Init Firebase Admin
  const db = initializeFirebaseAdmin().firestore();

  const batch = db.batch();
  const sessionRef = db.collection("activity_sessions").doc(sessionId);

  heartbeats.forEach((hb: any) => {
    const hbRef = sessionRef.collection("heartbeats").doc();
    batch.set(hbRef, {
      videoTime: hb.videoTime,
      isPlaying: hb.isPlaying,
      tabActive: hb.tabActive ?? true,
      timestamp: hb.timestamp,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  const response = NextResponse.json({
    success: true,
    stored: heartbeats.length,
  });

  return addCorsHeaders(response, req);
}
