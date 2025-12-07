// /app/api/refresh-short-token/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders, createSignedResponse } from "@/lib/cors";
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
    const response = NextResponse.json({ error: "SERVER_NOT_READY" }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  if (!verifySignature(body)) {
    const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
    return addCorsHeaders(response, req);
  }

  try {
    const { sessionToken } = body;
    if (!sessionToken) {
      const response = NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 });
      return addCorsHeaders(response, req);
    }
    
    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      const response = NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 });
      return addCorsHeaders(response, req);
    }
    
    const sessionData = sessionSnap.data();
    if (!sessionData || sessionData.status !== 'active') {
        const response = NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 400 });
        return addCorsHeaders(response, req);
    }

    const shortToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Expires in 5 minutes

    const tokenDoc = {
      token: shortToken,
      userId: sessionData.userId, 
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
    };

    await firestore.collection("short_lived_tokens").doc(shortToken).set(tokenDoc);

    return createSignedResponse({
      success: true,
      shortToken: shortToken,
    }, 200, req);

  } catch (err: any) {
    console.error("API Error: /api/refresh-short-token failed.", { error: err.message, timestamp: new Date().toISOString() });
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
