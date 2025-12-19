// src/lib/cors.ts
import { NextResponse } from 'next/server';

const allowedOriginPattern = /^chrome-extension:\/\/(\w+)$/;

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Origin', // Simplified headers
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };

  if (origin && (allowedOriginPattern.test(origin) || origin.startsWith('http://localhost:'))) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (process.env.NEXT_PUBLIC_APP_URL && origin === process.env.NEXT_PUBLIC_APP_URL) {
    headers['Access-Control-Allow-Origin'] = origin;
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
