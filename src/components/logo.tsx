'use client';

import { PlayCircle } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2 font-extrabold text-2xl text-primary tracking-tighter">
      <PlayCircle className="h-7 w-7" />
      <span>ViewLoop</span>
    </div>
  );
}
