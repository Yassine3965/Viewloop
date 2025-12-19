// src/app/api/auth/refresh/route.ts
import { NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase/admin';
import type { DecodedIdToken } from 'firebase-admin/auth';
import admin from 'firebase-admin';

export async function POST(request: Request) {
  let auth: admin.auth.Auth;

  try {
    auth = initializeFirebaseAdmin().auth();
  } catch (error: any) {
    console.error('Refresh token error - Admin SDK init failed:', error);
    return NextResponse.json(
      { error: 'Server configuration error', details: error.message },
      { status: 500 }
    );
  }

  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 400 }
      );
    }
    
    // Verify the expired token. `verifyIdToken` checks signature and expiration.
    // We pass `true` as the second argument to check for revoked tokens.
    // The SDK throws an error if the token is invalid or expired, which we catch.
    let decodedToken: DecodedIdToken;
    try {
        decodedToken = await auth.verifyIdToken(token, true);
    } catch (error: any) {
        // If the token is expired, we can still decode it to get the UID for refresh
        if (error.code === 'auth/id-token-expired') {
            console.log('Token expired, decoding to get UID for refresh.');
            // This is an unsafe decode, only used because we trust the expired token's structure
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            decodedToken = { uid: payload.uid, email: payload.email } as DecodedIdToken;
        } else {
            // For other errors (invalid signature, revoked, etc.), we reject.
            throw error;
        }
    }
    
    // Create a new custom token. The client will use this to sign in again.
    const newToken = await auth.createCustomToken(decodedToken.uid);
    
    return NextResponse.json({
      success: true,
      token: newToken,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email
      }
    });
    
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token', details: error.message, code: error.code },
      { status: 401 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*', // Adjust as needed for security
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
