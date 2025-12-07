// src/lib/cors.ts
import { NextResponse } from 'next/server';
import { signData, getServerPublicKey } from './firebase/admin';

const allowedOriginPattern = /^chrome-extension:\/\/(\w+)$/;

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Origin, X-Server-Signature, X-Server-Public-Key-Id, X-Server-Timestamp',
    'Access-Control-Expose-Headers': 'X-Server-Signature, X-Server-Public-Key-Id, X-Server-Timestamp',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin', // Important for caching
  };

  if (origin && (allowedOriginPattern.test(origin) || origin.startsWith('http://localhost:'))) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (origin === process.env.NEXT_PUBLIC_APP_URL) {
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

export async function createSignedResponse(data: Record<string, any>, status: number = 200, request: Request) {
    const signature = signData(data);
    const publicKey = getServerPublicKey();

    const response = NextResponse.json({
        data,
        signature,
        timestamp: Date.now(),
        publicKeyId: publicKey.keyId
    }, { status });

    response.headers.set('X-Server-Signature', signature);
    response.headers.set('X-Server-Public-Key-Id', publicKey.keyId);
    response.headers.set('X-Server-Timestamp', String(Date.now()));

    return addCorsHeaders(response, request);
}
