// /app/api/calculate-points/route.ts - Final points calculation
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "../../../lib/cors";
import { createHmac } from 'crypto';
import { getFirestore } from "@/lib/firebase/admin";

const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

// Reference to sessions from heartbeat-batch (in production, use shared storage)
const secureSessions = new Map();
const processedSessions = new Set();

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  // Verify signature
  const signature = req.headers.get('x-signature');
  if (!signature) {
    const response = NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 401 });
    return addCorsHeaders(response, req);
  }

  const expectedSignature = createHmac('sha256', EXTENSION_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

  if (signature !== expectedSignature) {
    const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
    return addCorsHeaders(response, req);
  }

  try {
    const { sessionId, videoId, points, sessionData } = body;

    if (!sessionId || false) {
      const response = NextResponse.json({ error: 'Invalid request or session already processed' }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // Get session from Firestore
    const firestore = getFirestore();
    const sessionRef = firestore.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.exists ? sessionSnap.data() : null;
    if (!session) {
      const response = NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return addCorsHeaders(response, req);
    }

    // Calculate final points using secure server-side logic
    const serverCalculatedPoints = calculatePointsSecurely(session);

    // Save final points
    const finalPoints = serverCalculatedPoints;
    session.finalPoints = finalPoints;
    session.processed = true;

    processedSessions.add(sessionId);

    // Clean up after 5 minutes
    setTimeout(() => {
      secureSessions.delete(sessionId);
    }, 300000);

    console.log(`🏆 Points awarded for session ${sessionId}: ${finalPoints.totalPoints}`);

    const response = NextResponse.json({
      success: true,
      pointsAwarded: finalPoints.totalPoints,
      breakdown: finalPoints,
      sessionId: sessionId
    });
    return addCorsHeaders(response, req);

  } catch (err: any) {
    console.error('Calculate points error:', err);
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}

function calculatePointsSecurely(session: any) {
  const validSeconds = session.validSeconds || session.validHeartbeats * 5 || 0;
  const videoWatchSeconds = Math.max(0, validSeconds - 5);
  const videoPoints = videoWatchSeconds * 0.05;

  return {
    videoPoints: Math.round(videoPoints * 100) / 100,
    adPoints: 0,
    totalPoints: Math.round(videoPoints * 100) / 100,
    validSeconds: validSeconds
  };
}
