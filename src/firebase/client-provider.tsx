'use client';

import React from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, db } from './client'; // Import the pre-initialized instances

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // The instances are already created in client.ts.
  // We just pass them to the provider.
  // This component no longer needs useEffect or useState for initialization.
  return (
    <FirebaseProvider app={app} auth={auth} db={db}>
      {children}
    </FirebaseProvider>
  );
}
