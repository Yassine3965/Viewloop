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
      <PlayCircle className="h-7 w-7" />
      <span>ViewLoop</span>
    </div>
  );
}
