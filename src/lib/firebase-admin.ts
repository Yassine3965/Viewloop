import * as admin from "firebase-admin";

// Check if the key exists to avoid errors during build on platforms like Vercel
if (process.env.FIREBASE_ADMIN_KEY && !admin.apps.length) {
  try {
    const serviceAccountString = process.env.FIREBASE_ADMIN_KEY;
    
    // Attempt to parse the service account key
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountString);
    } catch (parseError) {
        console.warn("Could not parse FIREBASE_ADMIN_KEY directly, attempting to clean it...");
        // This handles cases where the key might be double-escaped in the environment variable.
        const cleanedKey = serviceAccountString.replace(/\\n/g, '\n').replace(/\\"/g, '"');
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
  } catch (error) {
      console.error("Firebase admin initialization error:", error);
      // Don't throw during build, but log the error.
  }
}

// Export null if admin is not initialized, allowing for runtime checks.
export const firestore = admin.apps.length ? admin.firestore() : null;
export const auth = admin.apps.length ? admin.auth() : null;
