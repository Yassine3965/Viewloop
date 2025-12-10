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

// Helper function to create a backward-compatible auth object
function createCompatibleAuth(authInstance: Auth) {
  const authWrapper = () => authInstance;
  Object.defineProperty(authWrapper, 'currentUser', { get: () => authInstance.currentUser });
  (authWrapper as any).onAuthStateChanged = authInstance.onAuthStateChanged.bind(authInstance);
  (authWrapper as any).signOut = authInstance.signOut.bind(authInstance);
  return authWrapper;
}

// ⚡ Immediate initialization for the bridge
if (typeof window !== 'undefined') {
  const initImmediately = () => {
    const win = window as any;

    if (!win.firebase || win.firebase.__isPlaceholder) {
      console.log('⚡ Firebase immediate initialization for bridge...');
      
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const auth = getAuth(app);
      
      win.firebase = {
        app: app,
        apps: getApps(),
        initializeApp: () => app,
        auth: createCompatibleAuth(auth),
        __bridgeInitialized: true,
        __initializedImmediately: true
      };
      
      console.log('✅ Firebase is ready immediately!');
      
      setTimeout(() => {
        const token = localStorage.getItem('userAuthToken');
        if (token && chrome.runtime && chrome.runtime.id) {
           chrome.runtime.sendMessage(chrome.runtime.id, {
             type: 'SHARE_TOKEN_TO_YOUTUBE',
             token: token
           });
        }
        window.dispatchEvent(new CustomEvent('firebaseReady'));
      }, 10);
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImmediately);
  } else {
    initImmediately();
  }
}

// Standard initialization for the app itself
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db };
