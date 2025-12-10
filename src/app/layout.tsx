
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
          
          // 🚨 منع جميع الجسور القديمة
          if (window.__viewloopBridgeLoaded || window.__viewloopFinalBridgeLoaded) {
            console.log('🚫 جسر محمّل مسبقاً، تخطي...');
            return;
          }
          
          // 🔧 تنظيف الجسور القديمة
          function cleanupOldBridges() {
            // 1. إزالة السكريبتات القديمة
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
              if (script.src && script.src.includes('content_bridge') && !script.src.includes('final')) {
                console.log('🗑️ إزالة جسر قديم:', script.src);
                script.remove();
              }
            });
            
            // 2. منع التهيئة المزدوجة
            window.__viewloopBridgeLoaded = true;
            window.__viewloopCleanupDone = true;
          }
          
          // 🚀 تحميل الجسر النهائي
          function loadFinalBridge() {
            console.log('📦 تحميل ViewLoop Bridge النهائي...');
            
            // تنظيف أولاً
            cleanupOldBridges();
            
            // تحميل الجسر الجديد
            const script = document.createElement('script');
            script.src = '/js/content_bridge.final.js';
            script.async = true;
            
            script.onload = function() {
              console.log('✅ ViewLoop Bridge النهائي محمّل بنجاح');
              
              // إرسال حدث أن الجسر جاهز
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('viewloopBridgeReady'));
              }, 100);
            };
            
            script.onerror = function(error) {
              console.error('❌ فشل تحميل الجسر النهائي:', error);
            };
            
            document.body.appendChild(script);
          }
          
          // ⏳ توقيت التحميل: بعد Firebase مباشرة
          if (window.firebase && window.firebase.__bridgeInitialized) {
            console.log('⚡ Firebase جاهز، تحميل الجسر...');
            setTimeout(loadFinalBridge, 500);
          } else {
            // انتظر Firebase
            const waitForFirebase = setInterval(() => {
              if (window.firebase && window.firebase.__bridgeInitialized) {
                clearInterval(waitForFirebase);
                console.log('🎯 Firebase أصبح جاهزاً، تحميل الجسر...');
                setTimeout(loadFinalBridge, 300);
              }
            }, 100);
            
            // وقت انتهاء الطلب
            setTimeout(() => {
              clearInterval(waitForFirebase);
              if (!window.__viewloopBridgeLoaded) {
                console.log('⚠️ انتظار Firebase انتهى، تحميل الجسر مباشرة');
                loadFinalBridge();
              }
            }, 3000);
          }
          
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
