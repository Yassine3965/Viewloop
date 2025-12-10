
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
      // اكتشاف وإزالة الجسر القديم
      (function() {
        console.log('🔍 البحث عن الجسور القديمة...');
        
        // 1. البحث عن سكريبت content_bridge.js القديم
        const oldScripts = document.querySelectorAll('script[src*="content_bridge"]');
        oldScripts.forEach(script => {
          if (!script.src.includes('final')) {
            console.log('🗑️ إزالة الجسر القديم:', script.src);
            script.remove();
          }
        });
        
        // 2. منع تحميل الجسر القديم إذا كان في الطريق
        window.__viewloopBridgeLoaded = true;
        window.__viewloopOldBridgeBlocked = true;
        
        console.log('✅ تم تنظيف الجسور القديمة');
      })();
      
      // تحميل الجسر الجديد
      setTimeout(function() {
        console.log('📦 تحميل ViewLoop Bridge الجديد...');
        
        const script = document.createElement('script');
        script.src = '/js/content_bridge.final.js';
        script.async = true;
        script.onload = () => console.log('✅ ViewLoop Bridge الجديد محمّل');
        script.onerror = (e) => console.error('❌ فشل تحميل الجسر الجديد:', e);
        
        document.body.appendChild(script);
      }, 800);
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
