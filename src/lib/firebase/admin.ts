// src/lib/firebase/admin.ts
import admin from 'firebase-admin';
import crypto from 'crypto';

let isInitialized = false;

export function initializeFirebaseAdmin() {
  if (!isInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        const missingVars = [];
        if (!projectId) missingVars.push('FIREBASE_PROJECT_ID');
        if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL');
        if (!privateKey) missingVars.push('FIREBASE_PRIVATE_KEY');
        const errorMessage = `Firebase Admin initialization failed. Missing required environment variables: ${missingVars.join(', ')}.`;
        console.error(`❌ [Firebase Admin] ${errorMessage}`);
        throw new Error(errorMessage);
    }
    
    // Ensure EXTENSION_SECRET is loaded
    if (!process.env.EXTENSION_SECRET) {
        const errorMessage = `Firebase Admin initialization failed. Missing required environment variable: EXTENSION_SECRET.`;
        console.error(`❌ [Firebase Admin] ${errorMessage}`);
        throw new Error(errorMessage);
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });

      isInitialized = true;

    } catch (error: any) {
      console.error("❌ [Firebase Admin] INIT ERROR:", error.message);
      throw new Error(`Firebase Admin initialization failed: ${error.message}`);
    }
  }
  
  return admin;
}


export function verifySignature(body: string, signature: string | null): boolean {
    const secret = process.env.EXTENSION_SECRET;
    if (!secret) {
        console.error('CRITICAL: EXTENSION_SECRET is not set on the server. Cannot verify signature.');
        return false;
    }
    if (!signature) {
        console.warn('Signature verification failed: No signature provided in headers.');
        return false;
    }

    try {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(body);
        const expectedSignature = hmac.digest('hex');
        
        if (signature.length !== expectedSignature.length) {
            console.warn('Signature verification failed: Length mismatch.');
            return false;
        }

        const areEqual = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

        if (!areEqual) {
            console.warn('Signature verification failed: Mismatch.');
        }

        return areEqual;
    } catch (error) {
        console.error('Error during signature verification:', error);
        return false;
    }
}
