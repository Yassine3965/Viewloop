// src/lib/firebase/admin.ts
import admin from 'firebase-admin';

// This is a flag to ensure we only initialize the app once.
let isInitialized = false;

/**
 * Initializes the Firebase Admin SDK, ensuring it's only done once.
 * This pattern is crucial for serverless environments like Vercel.
 */
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
      // We throw the error to ensure the API route fails clearly if initialization fails.
      throw new Error(`Firebase Admin initialization failed: ${error.message}`);
    }
  } else {
    // console.log("♻️ [Firebase Admin] Using existing instance.");
  }

  // Return the services, which are now guaranteed to be available.
  return {
    firestore: admin.firestore(),
    auth: admin.auth(),
  };
}
