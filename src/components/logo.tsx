'use client';

import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo() {
  return (
    <div
      className={cn(
        'shine-effect flex items-center gap-2 font-extrabold text-2xl text-primary tracking-tighter'
      )}
      style={{ '--shine-delay': '0s' } as React.CSSProperties}
    >
      <img src="/logo.png" alt="Logo" className="h-8 w-8 rounded-full border-2 border-primary p-0.5 shadow-lg shadow-primary/20" />
      <span>ViewLoop</span>
    </div>
  );
}
