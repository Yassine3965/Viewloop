// /app/api/health/route.ts - Health check endpoint
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { addCorsHeaders } from "@/lib/cors";

export async function GET(req: Request) {
  try {
    // Test Firebase Admin initialization
    const app = initializeFirebaseAdmin();

    // Get server info
    const serverInfo = {
      status: "healthy",
      timestamp: Date.now(),
      firebaseInitialized: !!app,
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0"
    };

    const response = NextResponse.json(serverInfo, { status: 200 });
    return addCorsHeaders(response, req);

  } catch (error: any) {
    console.error('Health check failed:', error);

    const errorResponse = NextResponse.json({
      status: "unhealthy",
      error: error.message,
      timestamp: Date.now()
    }, { status: 503 });

    return addCorsHeaders(errorResponse, req);
  }
}

export async function OPTIONS(req: Request) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response, req);
}
