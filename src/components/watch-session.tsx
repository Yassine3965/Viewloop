'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/app-provider';
import type { Video } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { Progress } from './ui/progress';
import { Loader2, XCircle, AlertTriangle, CheckCircle, MonitorPlay } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const WATCH_INTERVAL = 5000; // 5 seconds

export function WatchSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { videos, user } = useApp();
  const { toast } = useToast();

  const videoId = searchParams.get('videoId');

  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [progress, setProgress] = useState(0);
  const [sessionState, setSessionState] = useState<'idle' | 'watching' | 'completing' | 'error' | 'done'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalWatchedSeconds = useRef(0);
  const sessionActive = useRef(true);

  const cleanup = useCallback(() => {
    if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    watchIntervalRef.current = null;
    sessionActive.current = false;
  }, []);

  // Main watch loop
  useEffect(() => {
    if (sessionState !== 'watching' || !currentVideo || !user) return;

    watchIntervalRef.current = setInterval(() => {
      if (!sessionActive.current) return;
      
      totalWatchedSeconds.current += WATCH_INTERVAL / 1000;
      const newProgress = (totalWatchedSeconds.current / currentVideo.duration) * 100;
      setProgress(newProgress);

      if (totalWatchedSeconds.current >= currentVideo.duration) {
        setSessionState('completing');
      }
    }, WATCH_INTERVAL);

    return () => {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    };
  }, [sessionState, currentVideo, user]);

  // Handle completion
  useEffect(() => {
    if (sessionState === 'completing' && currentVideo) {
      cleanup();
      setSessionState('done');
    }
  }, [sessionState, currentVideo, cleanup]);
  
  // Find video and start session
  useEffect(() => {
    if (!videoId) {
      setErrorMessage("معرّف الفيديو مفقود.");
      setSessionState('error');
      return;
    }
    const video = videos.find(v => v.id === videoId);
    if (video) {
        setCurrentVideo(video);
        setSessionState('watching');
    } else if (videos.length > 0) { // ensure videos are loaded
        setErrorMessage("الفيديو المطلوب غير موجود.");
        setSessionState('error');
    }
  }, [videoId, videos]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionState === 'watching') {
        // You can use sendBeacon here if you need to report un-tracked time before closing
        // For now, we just let the session end.
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        cleanup();
    };
  }, [sessionState, cleanup]);


  if (sessionState === 'idle') {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4 flex-col gap-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">جارٍ تحميل جلسة المشاهدة...</p>
      </div>
    );
  }

  if (sessionState === 'error') {
    return (
      <div className="container py-8 text-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>حدث خطأ في الجلسة</AlertTitle>
          <AlertDescription>{errorMessage || 'حدث خطأ غير متوقع.'}</AlertDescription>
        </Alert>
        <Button onClick={() => window.close()} className="mt-4">
          إغلاق
        </Button>
      </div>
    );
  }

  if (sessionState === 'done') {
    toast({
        title: 'اكتمل الفيديو!',
        description: `شكرًا على المشاهدة.`,
    });
    // This will run after the toast is shown
    setTimeout(() => window.close(), 2000);

    return (
      <div className="container py-8 text-center">
        <div className="max-w-md mx-auto">
          <Alert variant="default" className="border-green-500">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>اكتملت المشاهدة!</AlertTitle>
            <AlertDescription>سيتم إغلاق هذه النافذة.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!currentVideo) {
    return (
      <div className="container py-8 text-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <XCircle className="h-4 w-4" />
          <AlertTitle>الفيديو غير موجود</AlertTitle>
          <AlertDescription>لم يتم العثور على الفيديو المطلوب.</AlertDescription>
        </Alert>
        <Button onClick={() => window.close()} className="mt-4">
          إغلاق
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8 h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-lg overflow-hidden relative shadow-lg flex flex-col items-center justify-center text-center p-8">
          <div className="mx-auto mb-4 w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary">
            {sessionState === 'completing' ? (
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            ) : (
              <MonitorPlay className="h-10 w-10 text-primary" />
            )}
          </div>
          <h2 className="text-lg font-semibold mb-2">
            {sessionState === 'completing' ? 'جارٍ التحقق...' : 'جلسة المشاهدة نشطة'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {sessionState === 'completing' ? 'يتم التحقق من المشاهدة الآن.' : 'أبقِ هذه النافذة مفتوحة أثناء مشاهدة الفيديو.'}
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <h3 className="text-base font-semibold truncate text-center">{currentVideo.title}</h3>
          <Progress value={progress} className="w-full h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>المشاهدة لمدة {currentVideo.duration} ثانية</span>
          </div>
        </div>

        {sessionState === 'watching' && (
          <div className="mt-6">
            <Button variant="destructive" className="w-full" onClick={() => { cleanup(); window.close(); }}>
              <XCircle className="mr-2 h-4 w-4" /> إنهاء وإغلاق
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
