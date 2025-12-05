import * as admin from "firebase-admin";

let firestoreInstance: admin.firestore.Firestore | null = null;
let authInstance: admin.auth.Auth | null = null;

// This function is designed to run only on the server.
if (typeof window === 'undefined') {
  // Check if the app is already initialized to prevent errors.
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            // Replace the literal `\n` characters with actual newlines
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });

        console.log("✅ Firebase Admin initialized successfully.");
        firestoreInstance = admin.firestore();
        authInstance = admin.auth();

      } catch (error: any) {
        console.error("❌ Firebase Admin initialization error:", error.message);
      }
    } else {
        console.error('❌ Firebase Admin variables missing:', {
            hasProjectId: !!projectId,
            hasClientEmail: !!clientEmail,
            hasPrivateKey: !!privateKey?.length
          });
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
