// /app/api/public-key/route.ts
import { NextResponse } from 'next/server';
import { initializeFirebaseAdmin, getServerPublicKey } from '@/lib/firebase/admin';
import { addCorsHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function GET(req: Request) {
    try {
        // Ensure admin is initialized to get keys
        initializeFirebaseAdmin(); 
        
        const publicKeyData = getServerPublicKey();

        const response = NextResponse.json(publicKeyData);
        return addCorsHeaders(response, req);

    } catch (error: any) {
        console.error("API Error: /api/public-key failed.", { error: error.message, timestamp: new Date().toISOString() });
        const response = NextResponse.json({ error: "SERVER_ERROR", details: "Could not retrieve public key." }, { status: 500 });
        return addCorsHeaders(response, req);
    }
}
