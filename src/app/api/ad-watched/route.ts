// /app/api/ad-watched/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore;
  } catch (error: any) {
    console.error("API Error: Firebase Admin initialization failed.", { message: error.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 }), req);
  }

  let body;
  try {
    const rawBody = await req.text();
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (e) {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }), req);
  }

  try {
    // The session token is now the primary authenticator for this action.
    const { sessionToken } = body;
    if (!sessionToken) {
      return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 }), req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }), req);
    }

    const sessionData = sessionSnap.data();
    if (!sessionData) {
        return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 }), req);
    }

    if (sessionData.adWatched === true) {
      return addCorsHeaders(NextResponse.json({
        success: false,
        error: "AD_ALREADY_PROCESSED",
        message: "This ad has already been processed for this session."
      }, { status: 200 }), req);
    }

    const pointsForAd = 20;

    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection("users").doc(sessionData.userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new Error("User not found during transaction");
      }
      
      const currentPoints = userSnap.data()?.points || 0;
      const newPoints = currentPoints + pointsForAd;

      transaction.update(userRef, { points: newPoints });
      transaction.update(sessionRef, { adWatched: true });
    });

    return addCorsHeaders(NextResponse.json({
      success: true,
      message: "تم منح 20 نقطة لمشاهدة الإعلان.",
      pointsAdded: pointsForAd
    }), req);

  } catch (err: any) {
    console.error("API Error: /api/ad-watched failed.", { error: err.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
