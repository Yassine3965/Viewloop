
'use client';

import Link from 'next/link';
import { Logo } from './logo';

export function Footer() {
  return (
    <footer className="w-full border-t bg-card">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <Logo />
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            بناء وتصميم © {new Date().getFullYear()}. جميع الحقوق محفوظة.
          </p>
        </div>
        <nav className="flex items-center gap-4 md:gap-6 text-sm text-muted-foreground">
          <Link href="/how-it-works" className="hover:text-primary transition-colors" prefetch={false}>
            كيف يعمل
          </Link>
          <Link href="/how-to-earn-more" className="hover:text-primary transition-colors" prefetch={false}>
            كيف تربح أكثر
          </Link>
          <Link href="/privacy-policy" className="hover:text-primary transition-colors" prefetch={false}>
            سياسة الخصوصية
          </Link>
        </nav>
      </div>
    </footer>
  );
}
