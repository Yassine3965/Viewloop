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

// Helper function to create a compatible auth object for the content script bridge
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
  
  // Also attach properties directly for different access patterns
  Object.defineProperty(authWrapper, 'currentUser', {
    get: () => authInstance.currentUser
  });
  
  return authWrapper;
}


// This code runs immediately when the module is imported.
// It sets up the bridge for the content script.
if (typeof window !== 'undefined') {
  // Ensure we don't overwrite it if it's already there and properly initialized
  if (!(window as any).firebase || !(window as any).firebase.__bridgeInitialized) {
    
    (window as any).firebase = {
      app: app,
      apps: getApps(),
      initializeApp: () => app,
      // The bridge expects auth to be a function that returns an object
      // with currentUser, onAuthStateChanged, etc.
      auth: createCompatibleAuth(auth),
      __bridgeInitialized: true // Flag to prevent re-initialization
    };

    // Dispatch a custom event to notify the content script that Firebase is ready.
    window.dispatchEvent(new CustomEvent('firebaseReady'));
  }
}

export { app, auth, db };