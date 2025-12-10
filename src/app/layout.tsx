
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
              // Firebase Placeholder Bridge with Self-Correction
              // This runs instantly to prevent a race condition with the content script.
              (function() {
                if (typeof window !== 'undefined' && (!window.firebase || !window.firebase.__bridgeInitialized)) {
                  console.log('⏳ Creating placeholder Firebase bridge...');
                  window.firebase = {
                    __isPlaceholder: true,
                    auth: function() {
                      return {
                        currentUser: null,
                        getIdToken: function() { return Promise.reject('Firebase not fully loaded yet'); },
                        onAuthStateChanged: function() { console.warn('Firebase not ready, onAuthStateChanged ignored.'); }
                      };
                    }
                  };

                  // Start polling to check for the real Firebase bridge
                  var attempts = 0;
                  var maxAttempts = 50; // 5 seconds
                  var intervalId = setInterval(function() {
                    if (window.firebase && window.firebase.__bridgeInitialized) {
                      console.log('✅ Real Firebase bridge detected by placeholder. Clearing interval.');
                      clearInterval(intervalId);
                      // The real bridge's 'firebaseReady' event will handle notification.
                    } else if (attempts >= maxAttempts) {
                      console.warn('⚠️ Placeholder timed out waiting for real Firebase bridge.');
                      clearInterval(intervalId);
                    }
                    attempts++;
                  }, 100);
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
