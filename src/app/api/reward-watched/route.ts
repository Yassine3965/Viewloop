// /app/api/reward-watched/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

const REWARD_BONUS_RATE_PER_SECOND = 0.5; // 0.5 points per second
const GEMS_FOR_REWARD = 1; // 1 Gem bonus for watching any reward

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

  // التحقق من نوع الطلب - body يجب أن يكون كائن صحيح
  if (!body || typeof body !== 'object') {
    const response = NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  if (!verifySignature(req, body)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }

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
    const { sessionToken, rewardDuration } = body;
    if (!sessionToken || typeof rewardDuration !== 'number' || rewardDuration <= 0) {
      const response = NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
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

    if (sessionData.rewardWatched === true) {
        return addCorsHeaders(NextResponse.json({
            success: false,
            error: "REWARD_ALREADY_PROCESSED",
            message: "This reward has already been processed for this session."
          }, { status: 200 }), req);
    }

    const pointsForReward = rewardDuration * REWARD_BONUS_RATE_PER_SECOND;

    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection("users").doc(sessionData.userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new Error("User not found during transaction");
      }

      transaction.update(userRef, {
        points: admin.firestore.FieldValue.increment(pointsForReward),
        gems: admin.firestore.FieldValue.increment(GEMS_FOR_REWARD)
      });
      transaction.update(sessionRef, {
        rewardWatched: true,
        rewardHeartbeats: admin.firestore.FieldValue.increment(Math.ceil(rewardDuration / 15)) // Assuming 15s per heartbeat
      });
    });

    return addCorsHeaders(NextResponse.json({
      success: true,
      message: `تم منح ${pointsForReward.toFixed(2)} نقطة و ${GEMS_FOR_REWARD} جوهرة للمكافأة.`,
      pointsAdded: pointsForReward,
      gemsAdded: GEMS_FOR_REWARD
    }), req);

  } catch (err: any) {
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
