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

  // تحقق من متغير البيئة للمفتاح الخدمة
  const serviceAccountJson = process.env.FIREBASE_ADMIN_KEY;

  if (!serviceAccountJson) {
    const errorMessage = 'Missing Firebase environment variable: FIREBASE_ADMIN_KEY';
    console.error('❌ Firebase Admin init failed:', errorMessage);
    throw new Error(errorMessage);
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    console.log('🔐 Initializing Firebase Admin SDK...');

    // إذا كان التطبيق موجود بالفعل، استخدمه
    if (admin.apps.length > 0) {
      firebaseApp = admin.app();
      console.log('✅ Using existing Firebase Admin app');
    } else {
      // إنشاء التطبيق
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
        // databaseURL not needed for Firestore
      });
      console.log('✅ Firebase Admin initialized successfully');
    }

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
