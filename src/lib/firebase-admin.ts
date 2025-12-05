import * as admin from "firebase-admin";

let firestoreInstance: admin.firestore.Firestore | null = null;
let authInstance: admin.auth.Auth | null = null;

if (typeof window === 'undefined') {
  console.log("🔧 [Firebase Admin] Server-side initialization starting...");
  
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    console.log("📊 [Firebase Admin] Env vars check:", {
      projectId: projectId ? `✅ (${projectId})` : '❌ MISSING',
      clientEmail: clientEmail ? `✅ (${clientEmail.substring(0, 20)}...)` : '❌ MISSING',
      privateKey: privateKey ? `✅ (${privateKey.length} chars)` : '❌ MISSING',
      allPresent: !!(projectId && clientEmail && privateKey)
    });

    if (projectId && clientEmail && privateKey) {
      try {
        const formattedKey = privateKey.replace(/\\n/g, '\n');
        
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: formattedKey,
          }),
        });

        console.log("✅ [Firebase Admin] Initialized SUCCESSFULLY");
        
        firestoreInstance = admin.firestore();
        authInstance = admin.auth();
        
        console.log("🎯 [Firebase Admin] Services ready:", {
          firestore: !!firestoreInstance,
          auth: !!authInstance
        });

      } catch (error: any) {
        console.error("❌ [Firebase Admin] INIT ERROR:", {
          message: error.message,
          code: error.code,
          stack: error.stack?.split('\n')[0]
        });
      }
    } else {
      console.error('❌ [Firebase Admin] MISSING OR INCOMPLETE VARIABLES.');
    }
  } else {
    firestoreInstance = admin.firestore();
    authInstance = admin.auth();
    console.log("♻️ [Firebase Admin] Using existing Firebase Admin app instance.");
  }
}

export const firestore = firestoreInstance;
export const auth = authInstance;
