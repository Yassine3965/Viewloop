
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
          
          console.log('🛡️ ViewLoop Bridge Controller Starting...');
          
          window.__viewloopController = {
            version: '1.0',
            oldBridgeBlocked: false,
            newBridgeLoaded: false
          };
          
          function cleanOldBridges() {
            console.log('🧹 تنظيف الجسور القديمة...');
            
            const scripts = document.querySelectorAll('script[src*="content_bridge"]');
            scripts.forEach(script => {
              if (!script.src.includes('final.js')) {
                console.log('🗑️ Removing:', script.src);
                script.remove();
              }
            });
            
            delete window.__viewloopBridgeLoaded;
            window.__viewloopController.oldBridgeBlocked = true;
          }
          
          function loadNewBridge() {
            if (window.__viewloopController.newBridgeLoaded || window.__viewloopFinalBridgeLoaded) {
              console.log('ℹ️ الجسر الجديد محمّل مسبقاً');
              return;
            }
            
            console.log('📦 تحميل ViewLoop Bridge الجديد...');
            window.__viewloopController.newBridgeLoaded = true;
            
            const script = document.createElement('script');
            script.src = '/js/content_bridge.final.js';
            script.async = true;
            script.onload = () => console.log('✅ الجسر الجديد محمّل');
            script.onerror = (e) => console.error('❌ فشل التحميل:', e);
            
            document.body.appendChild(script);
          }
          
          cleanOldBridges();
          
          setTimeout(() => {
            loadNewBridge();
            setTimeout(cleanOldBridges, 2000);
          }, 800);
          
          console.log('✅ Bridge Controller active');
          
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
