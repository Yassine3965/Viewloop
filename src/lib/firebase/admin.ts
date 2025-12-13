// src/lib/firebase/admin.ts
import admin from 'firebase-admin';
import crypto from 'crypto';

let isInitialized = false;

let firebaseApp: admin.app.App | null = null;

export function initializeFirebaseAdmin(): admin.app.App {
  // إذا كان التطبيق مهيئاً بالفعل، أرجع النسخة الموجودة
  if (firebaseApp) {
    return firebaseApp;
  }

  // تحقق من متغيرات البيئة
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    const missingVars = [];
    if (!projectId) missingVars.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missingVars.push('FIREBASE_PRIVATE_KEY');

    const errorMessage = `Missing Firebase environment variables: ${missingVars.join(', ')}`;
    console.error('❌ Firebase Admin init failed:', errorMessage);
    throw new Error(errorMessage);
  }

  try {
    // إصلاح تنسيق المفتاح الخاص
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    console.log('🔐 Initializing Firebase Admin SDK...');

    // إنشاء التطبيق
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey
      }),
      databaseURL: `https://${projectId}.firebaseio.com`
    });

    console.log('✅ Firebase Admin initialized successfully');

    return firebaseApp;

  } catch (error: any) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    throw error;
  }
}

// دالة مساعدة للتحقق من التوكن
export async function verifyFirebaseToken(token: string) {
  try {
    const app = initializeFirebaseAdmin();
    const decoded = await app.auth().verifyIdToken(token);

    console.log('✅ Token verified for user:', {
      uid: decoded.uid,
      email: decoded.email?.substring(0, 20) + '...'
    });

    return decoded;
  } catch (error: any) {
    console.error('❌ Token verification failed:', {
      error: error.message,
      code: error.code
    });
    throw error;
  }
}

// دالة للحصول على Firestore
export function getFirestore(): admin.firestore.Firestore {
  const app = initializeFirebaseAdmin();
  return app.firestore();
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
