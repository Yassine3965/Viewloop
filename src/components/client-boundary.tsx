'use client';

import { ReactNode } from 'react';
import { Header } from './header';
import { AppProvider } from '@/lib/app-provider';

export function ClientBoundary({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
        <div className="relative flex min-h-screen w-full flex-col">
            <Header />
            <main className="flex-1 flex flex-col">{children}</main>
        </div>
    </AppProvider>
  );
}
