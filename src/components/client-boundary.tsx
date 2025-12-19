'use client';

import { ReactNode, useEffect } from 'react';
import { Header } from './header';
import { AppProvider } from '@/lib/app-provider';
import { Footer } from './footer';

export function ClientBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration.scope);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }
  }, []);

  return (
    <AppProvider>
        <div className="relative flex min-h-screen w-full flex-col">
            <Header />
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
        </div>
    </AppProvider>
  );
}
