'use client';

import { useEffect, useState } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseProvider } from './provider';

const firebaseConfig = {
  apiKey: "AIzaSyBDRLk64HrmlsRKn0BqC3kdmvapOoA_u6g",
  authDomain: "studio-3607665764-5c7db.firebaseapp.com",
  projectId: "studio-3607665764-5c7db",
  storageBucket: "studio-3607665764-5c7db.firebasestorage.app",
  messagingSenderId: "937439846340",
  appId: "1:937439846340:web:0793e5ad6b5c5ea54fce91",
  measurementId: "G-LZY93HSKZR"
};

function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebase, setFirebase] = useState<{
    app: FirebaseApp;
    auth: Auth;
    db: Firestore;
  } | null>(null);

  useEffect(() => {
    // Firebase is client-side only. This ensures it's only initialized in the browser.
    if (typeof window !== 'undefined') {
        const instances = initializeFirebase();
        setFirebase(instances);

        // Expose the initialized app to the window for the extension bridge,
        // matching the structure the bridge expects.
        if (!(window as any).firebase) {
          (window as any).firebase = {
            app: instances.app,
            apps: [instances.app],
            initializeApp: () => instances.app,
            auth: () => instances.auth,
          };
        }
    }
  }, []);

  // While Firebase is initializing, you can show a loader or nothing.
  // Once initialized, it renders the provider with the instances.
  if (!firebase) {
    return null; // Or a loading spinner
  }

  return (
    <FirebaseProvider app={firebase.app} auth={firebase.auth} db={firebase.db}>
      {children}
    </FirebaseProvider>
  );
}
