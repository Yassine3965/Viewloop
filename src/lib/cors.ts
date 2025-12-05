// src/lib/cors.ts
import { NextResponse } from 'next/server';

const allowedOriginPattern = /^chrome-extension:\/\/(\w+)$/;

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin', // Important for caching
  };

  if (origin && allowedOriginPattern.test(origin)) {
    // Dynamically set the origin if it matches the expected pattern
    headers['Access-control-allow-origin'] = origin;
  } else {
    // Fallback or deny if it's not a chrome extension
    // For development, you might want a more permissive fallback,
    // but for production, it's better to be strict.
    // We will allow requests to proceed and let the browser handle it,
    // but we won't add the Allow-Origin header for non-matching origins.
  }
  
  return headers;
}

export function handleOptions(req: Request): NextResponse {
  const origin = req.headers.get('Origin');
  const headers = getCorsHeaders(origin);
  return new NextResponse(null, {
    status: 204,
    headers: headers,
  });
}

export function addCorsHeaders(response: NextResponse, request: Request): NextResponse {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
