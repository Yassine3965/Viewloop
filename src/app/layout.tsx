
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ClientBoundary } from '@/components/client-boundary';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import '@/firebase/client'; // <-- Import here to ensure early initialization

export const metadata: Metadata = {
  title: 'ViewLoop',
  description: 'عزز مشاهداتك، دون عناء',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='hsl(205, 80%, 50%)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'></circle><polygon points='10 8 16 12 10 16 10 8'></polygon></svg>"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
      (function() {
        'use strict';
        
        console.log('🛡️ ViewLoop Bridge Controller v2.0');
        
        // 1. If the extension bridge is already loaded, we don't need the local one.
        if (window.__viewloopExtensionLoaded) {
          console.log('✅ Chrome extension bridge detected, using it directly.');
          
          // Just ensure Firebase is initialized for it
          if (!window.firebase || !window.firebase.__bridgeInitialized) {
            console.log('⚡ Initializing Firebase for the extension...');
            // The main client.ts will handle this, this is just a log.
          }
          
          return; // Do not load the local bridge
        }
        
        // 2. If the extension is NOT loaded, load the local fallback bridge.
        console.log('🌐 Chrome extension not detected, loading local fallback bridge...');
        
        // Clean up any old bridge scripts that might have been injected
        const oldScripts = document.querySelectorAll('script[src*="content_bridge"]');
        oldScripts.forEach(script => script.remove());
        
        // Load the minimal local bridge
        setTimeout(() => {
          const script = document.createElement('script');
          script.src = '/js/content_bridge.min.js';
          script.async = true;
          script.onload = () => console.log('✅ Local fallback bridge loaded.');
          document.body.appendChild(script);
        }, 500);
        
      })();
    `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        <Providers>
          <FirebaseClientProvider>
            <ClientBoundary>{children}</ClientBoundary>
          </FirebaseClientProvider>
        </Providers>
      </body>
    </html>
  );
}
