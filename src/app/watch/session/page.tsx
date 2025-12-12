'use client'

import { WatchSession } from "@/components/watch-session";
import { Suspense } from "react";
import { useApp } from '@/lib/app-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

function WatchSessionPageContent() {
  const { user, isUserLoading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace(`/login`);
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return <WatchSession />;
}

export default function WatchSessionPage() {
  return (
    <main className="flex-1">
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>}>
        <WatchSessionPageContent />
      </Suspense>
    </main>
  );
}
