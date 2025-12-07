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
    const admin = initializeFirebaseAdmin();
    firestore = admin.firestore;
  } catch (error: any) {
    console.error("API Error: Firebase Admin initialization failed.", { message: error.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 }), req);
  }

  if (req.headers.get("content-type") !== "application/json") {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 400 }), req);
  }

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return addCorsHeaders(NextResponse.json({ error: "EMPTY_BODY" }, { status: 400 }), req);
    }
    const body = JSON.parse(rawBody);

    if (body.extensionSecret !== process.env.EXTENSION_SECRET) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

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
      return addCorsHeaders(NextResponse.json({ error: "AD_ALREADY_PROCESSED", message: "This ad has already been processed for this session." }, { status: 400 }), req);
    }

    const pointsForAd = 20;

    // Use a transaction to ensure atomicity
    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection("users").doc(sessionData.userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new Error("User not found");
      }
      
      const currentPoints = userSnap.data()?.points || 0;
      const newPoints = currentPoints + pointsForAd;

      // Update user and session in the transaction
      transaction.update(userRef, { points: newPoints });
      transaction.update(sessionRef, { adWatched: true });
    });

    return addCorsHeaders(NextResponse.json({
      success: true,
      message: "تم منح 20 نقطة لمشاهدة الإعلان.",
      pointsAdded: pointsForAd
    }), req);

  } catch (err: any) {
    if (err instanceof SyntaxError) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }), req);
    }
    console.error("API Error: /api/ad-watched failed.", { error: err.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
