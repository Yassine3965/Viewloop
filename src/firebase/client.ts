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

// This code runs immediately when the module is imported.
// It sets up the bridge for the content script.
if (typeof window !== 'undefined') {
  // Ensure we don't overwrite it if it's already there.
  if (!(window as any).firebase) {
    // Create the structure expected by the content_bridge.js script
    (window as any).firebase = {
      app: app,
      apps: [app],
      initializeApp: () => app,
      // The bridge expects auth() to be a function that returns the auth instance
      auth: () => auth, 
    };

    // Dispatch a custom event to notify the content script that Firebase is ready.
    // This solves the race condition.
    window.dispatchEvent(new CustomEvent('firebaseReady'));
  }
}

export { app, auth, db };
