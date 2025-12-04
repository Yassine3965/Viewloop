import * as admin from "firebase-admin";

let firestoreInstance: admin.firestore.Firestore | null = null;
let authInstance: admin.auth.Auth | null = null;

// This function is designed to run only on the server.
if (typeof window === 'undefined') {
  // Check if the app is already initialized to prevent errors.
  if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_ADMIN_KEY;

    if (serviceAccountKey) {
      try {
        let serviceAccount;
        // First attempt to parse directly
        try {
            serviceAccount = JSON.parse(serviceAccountKey);
        } catch (e) {
            console.warn("Could not parse FIREBASE_ADMIN_KEY directly, attempting to clean it...");
            // This handles cases where the key might be double-escaped in the environment variable.
            const cleanedKey = serviceAccountKey.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            serviceAccount = JSON.parse(cleanedKey);
        }
        
        // Normalize newlines in private_key, as they often get escaped.
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        
        console.log("Firebase Admin initialized successfully.");
        firestoreInstance = admin.firestore();
        authInstance = admin.auth();

      } catch (error: any) {
        console.error("Firebase Admin initialization error:", error.message);
        // Don't throw during build, but log the error. This helps debug Vercel deployments.
      }
    } else {
      console.warn("FIREBASE_ADMIN_KEY environment variable is not set. Firebase Admin SDK not initialized.");
    }
  } else {
    // If already initialized, just get the instances.
    firestoreInstance = admin.firestore();
    authInstance = admin.auth();
  }
}

// Export the initialized instances (or null if initialization failed).
export const firestore = firestoreInstance;
export const auth = authInstance;
