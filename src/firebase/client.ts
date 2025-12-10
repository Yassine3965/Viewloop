'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBDRLk64HrmlsRKn0BqC3kdmvapOoA_u6g",
  authDomain: "studio-3607665764-5c7db.firebaseapp.com",
  projectId: "studio-3607665764-5c7db",
  storageBucket: "studio-3607665764-5c7db.firebasestorage.app",
  messagingSenderId: "937439846340",
  appId: "1:937439846340:web:0793e5ad6b5c5ea54fce91",
  measurementId: "G-LZY93HSKZR"
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

// Helper function to create a backward-compatible auth object for the content script bridge
function createCompatibleAuth(authInstance: Auth) {
  const authWrapper = () => {
    return {
      currentUser: authInstance.currentUser,
      onAuthStateChanged: authInstance.onAuthStateChanged.bind(authInstance),
      signOut: authInstance.signOut.bind(authInstance),
      getIdToken: (forceRefresh = false): Promise<string> => {
        if (!authInstance.currentUser) {
          return Promise.reject('No user is currently signed in.');
        }
        return authInstance.currentUser.getIdToken(forceRefresh);
      }
    };
  };

  Object.defineProperty(authWrapper, 'currentUser', {
    get: () => authInstance.currentUser
  });
  
  (authWrapper as any).onAuthStateChanged = authInstance.onAuthStateChanged.bind(authInstance);
  (authWrapper as any).signOut = authInstance.signOut.bind(authInstance);

  return authWrapper;
}

// This code runs when the module is imported on the client-side.
if (typeof window !== 'undefined') {
  const win = window as any;

  // Only initialize if the real bridge isn't already there.
  // This avoids issues with React strict mode or HMR.
  if (!win.firebase || win.firebase.__isPlaceholder) {
    console.log('🚀 Initializing REAL Firebase Bridge for content script...');
    
    const compatibleAuth = createCompatibleAuth(auth);

    win.firebase = {
      app: app,
      apps: getApps(),
      initializeApp: () => app,
      auth: compatibleAuth,
      __bridgeInitialized: true // Flag to prevent re-initialization
    };

    console.log('✅ Real Firebase Bridge initialized successfully.');
    // Dispatch a custom event to notify the content script that Firebase is ready.
    window.dispatchEvent(new CustomEvent('firebaseReady'));
  }
}

export { app, auth, db };
