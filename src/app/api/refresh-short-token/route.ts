// /app/api/refresh-short-token/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';
import { randomBytes } from 'crypto';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req:Request) {
  let firestore: admin.firestore.Firestore;
  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore;
  } catch (error: any) {
    return addCorsHeaders(NextResponse.json({ error: "SERVER_NOT_READY" }, { status: 503 }), req);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }), req);
  }

  try {
    const { sessionToken } = body;
    if (!sessionToken) {
      return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 }), req);
    }
    
    // Get the session to find the associated user
    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }), req);
    }
    
    const sessionData = sessionSnap.data();
    if (!sessionData || sessionData.status !== 'active') {
        return addCorsHeaders(NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 400 }), req);
    }

    // Generate a new secure, short-lived token
    const shortToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Expires in 5 minutes

    const tokenDoc = {
      token: shortToken,
      userId: sessionData.userId, // Link the new token to the session's user
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
    };

    // Store the new token in Firestore
    await firestore.collection("short_lived_tokens").doc(shortToken).set(tokenDoc);

    return addCorsHeaders(NextResponse.json({
      success: true,
      shortToken: shortToken,
    }), req);

  } catch (err: any) {
    console.error("API Error: /api/refresh-short-token failed.", { error: err.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
