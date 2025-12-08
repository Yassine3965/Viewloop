// /app/api/ad-watched/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

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
    const { sessionToken } = body;
    if (!sessionToken) {
      const response = NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
      return addCorsHeaders(response, req);
    }
    
    const gemsForAd = 1; // 1 Gem bonus

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
    
    if (sessionData.adWatched === true) {
        return addCorsHeaders(NextResponse.json({
            success: false,
            error: "AD_ALREADY_PROCESSED",
            message: "This ad has already been processed for this session."
          }, { status: 200 }), req);
    }

    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection("users").doc(sessionData.userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new Error("User not found during transaction");
      }
      
      transaction.update(userRef, { gems: admin.firestore.FieldValue.increment(gemsForAd) });
      transaction.update(sessionRef, { adWatched: true });
    });

    return addCorsHeaders(NextResponse.json({
      success: true,
      message: `تم منح ${gemsForAd} جوهرة لمشاهدة الإعلان.`,
      gemsAdded: gemsForAd
    }), req);

  } catch (err: any) {
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
