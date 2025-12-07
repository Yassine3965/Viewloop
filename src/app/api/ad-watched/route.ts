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
    body = await req.json();
  } catch (e) {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }), req);
  }

  try {
    const { sessionToken, adDuration } = body; // ⭐ أضف adDuration
    if (!sessionToken || !adDuration) {
      return addCorsHeaders(NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 }), req);
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
    
    if (sessionData.extensionSecret !== process.env.EXTENSION_SECRET) {
      console.warn("Ad-watched failed: Invalid secret in session doc", { sessionToken });
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }

    if (sessionData.adWatched === true) {
      return addCorsHeaders(NextResponse.json({
        success: false,
        error: "AD_ALREADY_PROCESSED",
        message: "This ad has already been processed for this session."
      }, { status: 200 }), req);
    }

    // ⭐⭐⭐ التصحيح: 1 نقطة لكل ثانية إعلان ⭐⭐⭐
    const pointsForAd = Math.floor(Number(adDuration) * 1);

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
      message: `تم منح ${pointsForAd} نقطة لمشاهدة الإعلان.`,
      pointsAdded: pointsForAd
    }), req);

  } catch (err: any) {
    console.error("API Error: /api/ad-watched failed.", { error: err.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
