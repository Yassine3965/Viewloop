// src/lib/firebase/admin.ts
import admin from 'firebase-admin';

let isInitialized = false;

export function initializeFirebaseAdmin() {
  if (!isInitialized) {
    console.log("🔧 [Firebase Admin] Attempting to initialize...");
    
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

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });

      console.log("✅ [Firebase Admin] Initialized SUCCESSFULLY.");
      isInitialized = true;

    } catch (error: any) {
      console.error("❌ [Firebase Admin] INIT ERROR:", error.message);
      throw new Error(`Firebase Admin initialization failed: ${error.message}`);
    }
  }
  
  return admin;
}

// This function is kept for simplicity, in a real scenario, you'd use a more robust signing mechanism
// if you were to re-introduce client-side signing. For now, it's not used by the lite extension.
export function verifySignature(body: Record<string, any>): boolean {
    if (!process.env.EXTENSION_SECRET) {
        console.error('CRITICAL: EXTENSION_SECRET is not set. Cannot verify signature.');
        return false;
    }

    // This is a placeholder for a simple secret check.
    // The "lite" extension doesn't do complex signing.
    return body.extensionSecret === process.env.EXTENSION_SECRET;
}
