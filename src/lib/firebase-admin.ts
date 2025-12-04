import * as admin from "firebase-admin";

// Check if the key exists to avoid errors during build on platforms like Vercel
if (process.env.FIREBASE_ADMIN_KEY && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_KEY as string)),
  });
}

// These will be properly initialized only when the service account key is available.
export const firestore = admin.firestore();
export const auth = admin.auth();
