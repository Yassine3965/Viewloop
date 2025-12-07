// /app/api/get-short-token/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';
import { randomBytes } from 'crypto';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
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
    const { extensionSecret } = body;

    if (extensionSecret !== process.env.EXTENSION_SECRET) {
      console.warn("Invalid secret received in get-short-token");
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }), req);
    }
    
    // Generate a secure, short-lived token
    const shortToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Expires in 5 minutes

    const tokenDoc = {
      token: shortToken,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
    };

    // Store the token in Firestore
    await firestore.collection("short_lived_tokens").doc(shortToken).set(tokenDoc);

    return addCorsHeaders(NextResponse.json({
      success: true,
      shortToken: shortToken,
    }), req);

  } catch (err: any) {
    console.error("API Error: /api/get-short-token failed.", { error: err.message, timestamp: new Date().toISOString() });
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }), req);
  }
}
