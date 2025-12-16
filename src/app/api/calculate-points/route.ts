// /app/api/calculate-points/route.ts - Final points calculation
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "../../../lib/cors";
import { createHmac, createHash } from 'crypto';
import { getFirestore } from "@/lib/firebase/admin";

// Use Firestore as the source of truth for session state

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

  try {
    const { sessionId, videoId, points, sessionData } = body;

    if (!sessionId) {
      const response = NextResponse.json({ error: 'MISSING_SESSION_ID' }, { status: 400 });
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

    // Verify session token
    if (!session.sessionToken) {
      const response = NextResponse.json({ error: "INVALID_SESSION" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    // Verify signature with session token
    const signature = req.headers.get('x-signature');
    if (!signature) {
      const response = NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    const sortedKeys = Object.keys(body).sort();
    const sortedBody: Record<string, any> = {};
    sortedKeys.forEach(key => {
      sortedBody[key] = body[key];
    });
    const dataString = JSON.stringify(sortedBody);
    const combined = dataString + session.sessionToken;
    const expectedSignature = createHash('sha256')
      .update(combined)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.log('Signature mismatch:', { received: signature, expected: expectedSignature });
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
      return addCorsHeaders(response, req);
    }

    // Verify session status before processing
    if (session.status !== 'active') {
      return addCorsHeaders(
        NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 400 }),
        req
      );
    }

    if (session.processed === true) {
      return addCorsHeaders(
        NextResponse.json({ error: "SESSION_ALREADY_PROCESSED" }, { status: 409 }),
        req
      );
    }

    // Calculate final points using secure server-side logic
    const serverCalculatedPoints = calculatePointsSecurely(session);

    // Update user points in database
    if (session.userId && session.userId !== 'anonymous') {
      try {
        const userRef = firestore.collection("users").doc(session.userId);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
          const currentPoints = userSnap.data()?.points || 0;
          const newTotalPoints = currentPoints + serverCalculatedPoints.totalPoints;

          await userRef.update({
            points: newTotalPoints,
            lastUpdated: Date.now(),
            totalSessions: (userSnap.data()?.totalSessions || 0) + 1,
            totalWatchTime: (userSnap.data()?.totalWatchTime || 0) + serverCalculatedPoints.validSeconds
          });

          console.log(`✅ User ${session.userId} points updated: ${currentPoints} → ${newTotalPoints}`);
        } else {
          // Create user if doesn't exist
          await userRef.set({
            points: serverCalculatedPoints.totalPoints,
            lastUpdated: Date.now(),
            totalSessions: 1,
            totalWatchTime: serverCalculatedPoints.validSeconds,
            createdAt: Date.now()
          });

          console.log(`✅ New user ${session.userId} created with ${serverCalculatedPoints.totalPoints} points`);
        }

        // Add to watch history
        await firestore.collection("watchHistory").add({
          userId: session.userId,
          videoId: session.videoId,
          sessionId: sessionId,
          pointsEarned: serverCalculatedPoints.totalPoints,
          validSeconds: serverCalculatedPoints.validSeconds,
          completedAt: Date.now()
        });

      } catch (userUpdateError) {
        console.error('Error updating user points:', userUpdateError);
        // Continue with session update even if user update fails
      }
    }

    // Save final points to session
    const finalPoints = serverCalculatedPoints;
    session.finalPoints = finalPoints;
    session.processed = true;
    session.completedAt = Date.now();

    // Update session status and invalidate token
    await sessionRef.update({
      status: 'completed',
      finalPoints: finalPoints,
      processed: true,
      completedAt: Date.now(),
      sessionToken: null // Invalidate token - session is done
    });



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
