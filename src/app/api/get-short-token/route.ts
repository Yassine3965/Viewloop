// DEPRECATED - This file is no longer used and can be removed.
// The logic has been moved to /api/refresh-short-token and /api/start-session

import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  return addCorsHeaders(NextResponse.json({
    error: "DEPRECATED_ENDPOINT",
    message: "This endpoint is deprecated. Use /api/refresh-short-token instead."
  }, { status: 410 }), req);
}
