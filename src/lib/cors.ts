// src/lib/cors.ts
import { NextResponse } from 'next/server';

// ضع هنا ID الإضافة الفعلي من Chrome
const allowedOrigins = [
  'chrome-extension://djpncieodekmbejocghjhldjhkcaalic'
];

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0], // السماح للإضافة فقط
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Secret-Key',
};

export function handleOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function addCorsHeaders(response: NextResponse): NextResponse {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
