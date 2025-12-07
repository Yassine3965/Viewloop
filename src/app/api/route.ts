// /app/api/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";

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

  // This is a placeholder for any root API logic you might want.
  // For now, it acknowledges receipt of a signed request.
  
  const response = NextResponse.json({ success: true, message: "Root API endpoint reached." });
  return addCorsHeaders(response, req);
}
