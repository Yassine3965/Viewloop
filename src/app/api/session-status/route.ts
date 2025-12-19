// /app/api/session-status/route.ts
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
  let auth: admin.auth.Auth;

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
    auth = adminApp.auth();
  } catch (error: any) {
    const response = NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  const { sessionToken, userAuthToken } = body;
  if (!sessionToken || !userAuthToken) {
    const response = NextResponse.json({ error: "MISSING_PARAMETERS" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await auth.verifyIdToken(userAuthToken);
  } catch (err) {
    const response = NextResponse.json({ error: "INVALID_USER_TOKEN" }, { status: 401 });
    return addCorsHeaders(response, req);
  }
  
  const userId = decoded.uid;

  try {
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

    // Security check: ensure the user requesting the status is the owner of the session
    if (sessionData.userId !== userId) {
        const response = NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
        return addCorsHeaders(response, req);
    }

    // Return only the necessary, safe-to-view data
    const clientSafeData = {
        totalWatchedSeconds: sessionData.validSeconds || 0,
        status: sessionData.status,
        points: sessionData.points || 0,
        gems: sessionData.gems || 0,
        penaltyReasons: sessionData.penaltyReasons || [],
    };
    
    const response = NextResponse.json({ success: true, session: clientSafeData });
    return addCorsHeaders(response, req);

  } catch (err: any) {
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
