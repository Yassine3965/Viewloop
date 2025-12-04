import * as admin from "firebase-admin";

// Check if the key exists to avoid errors during build on platforms like Vercel
if (process.env.FIREBASE_ADMIN_KEY && !admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);

    // Normalize newlines in private_key
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
      console.error("Firebase admin initialization error:", error);
  }
}

// Export null if admin is not initialized
export const firestore = admin.apps.length ? admin.firestore() : null;
export const auth = admin.apps.length ? admin.auth() : null;
