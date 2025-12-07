// src/lib/firebase/admin.ts
import admin from 'firebase-admin';
import { createHmac, createSign, createHash, generateKeyPairSync } from 'crypto';

let isInitialized = false;

// Server-side signing key pair
let serverKeyPair: { publicKey: string; privateKey: string; };
let serverPublicKeyId: string;

function initializeSigningKeys() {
    if (!serverKeyPair) {
        console.log("🔐 Generating new server signing key pair...");
        serverKeyPair = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        const hash = createHash('sha256');
        hash.update(serverKeyPair.publicKey);
        serverPublicKeyId = hash.digest('hex').substring(0, 16);

        console.log(`✅ Server keys generated. Public Key ID: ${serverPublicKeyId}`);
    }
}

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
      initializeSigningKeys(); // Initialize signing keys on first admin init

    } catch (error: any) {
      console.error("❌ [Firebase Admin] INIT ERROR:", error.message);
      throw new Error(`Firebase Admin initialization failed: ${error.message}`);
    }
  }
  
  return {
    firestore: admin.firestore(),
    auth: admin.auth(),
  };
}

export function signData(data: Record<string, any>): string {
    const dataString = JSON.stringify(data);
    const signer = createSign('SHA256');
    signer.update(dataString);
    signer.end();
    return signer.sign(serverKeyPair.privateKey, 'base64');
}

export function getServerPublicKey() {
    if (!serverKeyPair) {
        initializeSigningKeys();
    }
    return {
        key: serverKeyPair.publicKey,
        keyId: serverPublicKeyId,
        algorithm: 'RSA-SHA256',
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
    };
}


export function verifySignature(body: Record<string, any>): boolean {
    if (!process.env.EXTENSION_SECRET) {
        console.error('CRITICAL: EXTENSION_SECRET is not set. Cannot verify signature.');
        return false;
    }

    if (!body.signature) {
        console.warn('Signature verification failed: No signature provided.');
        return false;
    }
    
    const { signature, ...signedData } = body;

    const expectedSignature = createHmac('sha256', process.env.EXTENSION_SECRET)
        .update(JSON.stringify(signedData))
        .digest('hex');

    if (signature !== expectedSignature) {
        console.warn('Signature verification failed: Invalid signature.');
        return false;
    }

    return true;
}
