
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ClientBoundary } from '@/components/client-boundary';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import '@/firebase/client'; // <-- Import here to ensure early initialization

export const metadata: Metadata = {
  title: 'ViewLoop',
  description: 'عزز مشاهداتك، دون عناء',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
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
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&family=Outfit:wght@400;600;800&family=Inter:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
      (function() {
        'use strict';
        
        console.log('🛡️ ViewLoop Bridge Controller v2.0');
        
        // 1. إذا كان الامتداد محملاً، لا نحتاج جسراً إضافياً
        if (window.__viewloopExtensionLoaded) {
          console.log('✅ امتداد Chrome محمّل، استخدامه مباشرة');
          
          // فقط تأكد من أن Firebase مهيأ
          if (!window.firebase || !window.firebase.__bridgeInitialized) {
            console.log('⚡ تهيئة Firebase للامتداد...');
          }
          
          return; // لا تحمّل جسراً إضافياً
        }
        
        // 2. إذا لم يكن الامتداد محملاً، حمّل الجسر المحلي
        console.log('🌐 امتداد Chrome غير محمّل، تحميل الجسر المحلي...');
        
        // تنظيف أي جسور قديمة
        const oldScripts = document.querySelectorAll('script[src*="content_bridge"]');
        oldScripts.forEach(script => script.remove());
        
        // تحميل الجسر المحلي المبسط
        setTimeout(() => {
          if(window.__viewloopMinBridgeLoaded) return;
          const script = document.createElement('script');
          script.src = '/js/content_bridge.min.js';
          script.async = true;
          script.onload = () => console.log('✅ الجسر المحلي محمّل');
          document.body.appendChild(script);
        }, 500);
        
      })();
    `,
          }}
        />
        <script src="/js/extension-compat.js" defer></script>
      </head>
      <body className="font-body antialiased relative selection:bg-primary/30">
        {/* Global Noise Overlay */}
        <div className="fixed inset-0 bg-noise pointer-events-none z-[9999]" />

        <Providers>
          <FirebaseClientProvider>
            <ClientBoundary>{children}</ClientBoundary>
          </FirebaseClientProvider>
        </Providers>
      </body>
    </html>
  );
}
