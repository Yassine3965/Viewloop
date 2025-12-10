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
