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
    const { totalPoints, totalGems, reputationDelta, validSeconds, extraSeconds } = calculatePointsSecurely(session);

    // Update user points and reputation in database
    if (session.userId && session.userId !== 'anonymous') {
      try {
        const userRef = firestore.collection("users").doc(session.userId);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
          const currentPoints = userSnap.data()?.points || 0;
          const currentGems = userSnap.data()?.gems || 0;
          const currentReputation = userSnap.data()?.reputation || 4.5;
          const newTotalPoints = currentPoints + totalPoints;
          const newTotalGems = currentGems + totalGems;

          const newReputation = Math.max(0, Math.min(5, currentReputation + reputationDelta));

          await userRef.update({
            points: newTotalPoints,
            gems: newTotalGems,
            reputation: newReputation,
            lastUpdated: Date.now(),
            totalSessions: (userSnap.data()?.totalSessions || 0) + 1,
            totalWatchTime: (userSnap.data()?.totalWatchTime || 0) + validSeconds
          });

          console.log(`✅ User ${session.userId} updated:`);
          console.log(`   Points: ${currentPoints} → ${newTotalPoints} (+${totalPoints})`);
          console.log(`   Gems: ${currentGems} → ${newTotalGems} (+${totalGems})`);
          console.log(`   Reputation: ${currentReputation} → ${newReputation} (${reputationDelta > 0 ? '+' : ''}${reputationDelta})`);
        } else {
          // Create user if doesn't exist (start with neutral reputation)
          const initialReputation = 4.5;
          await userRef.set({
            points: totalPoints,
            gems: totalGems,
            reputation: initialReputation,
            lastUpdated: Date.now(),
            totalSessions: 1,
            totalWatchTime: validSeconds,
            createdAt: Date.now()
          });

          console.log(`✅ New user ${session.userId} created:`);
          console.log(`   Points: ${totalPoints}`);
          console.log(`   Gems: ${totalGems}`);
        }

        // Add to watch history with reputation data
        await firestore.collection("watchHistory").add({
          userId: session.userId,
          videoId: session.videoId,
          sessionId: sessionId,
          pointsEarned: totalPoints,
          gemsEarned: totalGems,
          reputationDelta: reputationDelta,
          validSeconds: validSeconds,
          extraSeconds: extraSeconds,
          completedAt: Date.now()
        });

      } catch (userUpdateError) {
        console.error('Error updating user data:', userUpdateError);
        // Continue with session update even if user update fails
      }
    }

    // Save final points to session
    // Reconstruct object for backwards compatibility or storage
    const finalPoints = {
      totalPoints,
      totalGems,
      reputationDelta,
      validSeconds,
      extraSeconds
    };

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
  // Use session data or defaults. 
  // validSeconds comes from heartbeat analysis usually.
  const validSeconds = session.validSeconds || session.validHeartbeats * 5 || 0;

  // Assuming 'videoDuration' is available in session or we estimate it.
  // Ideally, session should have videoDuration. If not, we might be capped.
  // For this logic, we'll try to rely on what's passed or defaults.
  // If session doesn't have videoDuration, we default to validSeconds to avoid 'extra' without basis.
  const videoDuration = session.videoDuration || validSeconds;

  // Standard time is min(validSeconds, videoDuration)
  const standardSeconds = Math.min(validSeconds, videoDuration);

  // Extra time is max(0, validSeconds - videoDuration)
  const extraSeconds = Math.max(0, validSeconds - videoDuration);

  // 1. Standard Points: 0.05 per second
  const standardPoints = standardSeconds * 0.05;

  // 2. Extra Points: 0.5 per second (User Request: 0.5 for each extra time)
  const extraTimePoints = extraSeconds * 0.5;

  // 3. Gems
  // Standard: 0.01 per second
  // Extra: 0.02 per second
  const gems = (standardSeconds * 0.01) + (extraSeconds * 0.02);

  // Reputation: simple logic
  // If extraSeconds > 0, it's a dedicated session -> boost reputation
  const reputationDelta = extraSeconds > 0 ? +0.05 : 0;

  const totalPoints = standardPoints + extraTimePoints;

  return {
    totalPoints: Math.round(totalPoints * 100) / 100,
    totalGems: Math.round(gems * 100) / 100,
    reputationDelta,
    validSeconds,
    extraSeconds
  };
}
