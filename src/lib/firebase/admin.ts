// src/lib/firebase/admin.ts
import admin from 'firebase-admin';
import crypto from 'crypto';

let isInitialized = false;

export function initializeFirebaseAdmin() {
  if (!isInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const extensionSecret = process.env.EXTENSION_SECRET;

    if (!projectId || !clientEmail || !privateKey || !extensionSecret) {
        const missingVars = [];
        if (!projectId) missingVars.push('FIREBASE_PROJECT_ID');
        if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL');
        if (!privateKey) missingVars.push('FIREBASE_PRIVATE_KEY');
        if (!extensionSecret) missingVars.push('EXTENSION_SECRET');

        const errorMessage = `Firebase Admin initialization failed. Missing required environment variables: ${missingVars.join(', ')}.`;
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


export function verifySignature(req: Request, body: any): boolean {
    const secret = process.env.EXTENSION_SECRET;
    if (!secret) {
        console.error('CRITICAL: EXTENSION_SECRET is not set on the server.');
        return false;
    }

    const signature = req.headers.get('X-HMAC-Signature');
    if (!signature) {
        console.warn('Signature verification failed: No signature header.');
        return false;
    }
    
    // Reconstruct the payload exactly as it was on the client in the background script
    const requestData = {
      method: req.method,
      url: req.url,
      timestamp: Number(req.headers.get('X-Timestamp')),
      requestId: req.headers.get('X-Request-ID'),
      body: body 
    };

    try {
        const hmac = crypto.createHmac('sha256', secret);
        // Use a consistent, sorted stringification method
        hmac.update(JSON.stringify(requestData));
        const expectedSignature = hmac.digest('base64');
        
        // Use a safe comparison
        const areEqual = crypto.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(expectedSignature, 'base64'));

        if (!areEqual) {
            console.warn('Signature verification failed: Mismatch.');
        }

        return areEqual;
    } catch (error) {
        console.error('Error during signature verification:', error);
        return false;
    }
}
