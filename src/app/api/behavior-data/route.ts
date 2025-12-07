// /app/api/behavior-data/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  const requestBody = await req.text();
  const signature = req.headers.get('X-HMAC-Signature');

  if (!verifySignature(requestBody, signature)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }

  // For now, we just acknowledge receipt of the data.
  // In the future, this endpoint could store and analyze behavior data for fraud detection.
  
  const response = NextResponse.json({ success: true, message: "Behavior data received." });
  return addCorsHeaders(response, req);
}
