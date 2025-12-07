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
const HEARTBEAT_INTERVAL = 15000; // 15 seconds

export function WatchSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { videos, user } = useApp();
  const { toast } = useToast();

  const videoId = searchParams.get('videoId');

  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [progress, setProgress] = useState(0);
  const [sessionState, setSessionState] = useState<'idle' | 'starting' | 'watching' | 'completing' | 'error' | 'done'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalWatchedSeconds = useRef(0);
  const lastHeartbeatTime = useRef(Date.now());

  const cleanup = useCallback(() => {
    if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    watchIntervalRef.current = null;
    heartbeatIntervalRef.current = null;
  }, []);

  const sendHeartbeat = useCallback(async (token: string | null) => {
    if (!token) return;

    const watchedSinceLast = (Date.now() - lastHeartbeatTime.current) / 1000;
    lastHeartbeatTime.current = Date.now();
    
    try {
      await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: token,
          extensionSecret: process.env.NEXT_PUBLIC_EXTENSION_SECRET,
          watchedSinceLastHeartbeat: watchedSinceLast,
        }),
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, []);

  const completeSession = useCallback(async (token: string | null) => {
    if (!token) return;
    setSessionState('completing');
    cleanup();

    try {
      const response = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: token,
          extensionSecret: process.env.NEXT_PUBLIC_EXTENSION_SECRET,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast({
            title: 'اكتمل الفيديو!',
            description: `شكرًا على المشاهدة. لقد ربحت ${data.pointsAdded} نقطة.`,
        });
        setSessionState('done');
      } else {
        throw new Error(data.error || 'Failed to complete session');
      }
    } catch (error: any) {
        setErrorMessage('فشل في إنهاء الجلسة. ' + error.message);
        setSessionState('error');
    }
  }, [cleanup, toast]);


  // Main watch loop
  useEffect(() => {
    if (sessionState !== 'watching' || !currentVideo || !user) return;

    watchIntervalRef.current = setInterval(() => {
      totalWatchedSeconds.current += WATCH_INTERVAL / 1000;
      const newProgress = (totalWatchedSeconds.current / currentVideo.duration) * 100;
      setProgress(Math.min(newProgress, 100));

      if (newProgress >= 100) {
        completeSession(sessionToken);
      }
    }, WATCH_INTERVAL);

    return () => {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    };
  }, [sessionState, currentVideo, user, sessionToken, completeSession]);

  // Heartbeat loop
  useEffect(() => {
    if (sessionState !== 'watching' || !sessionToken) return;
    
    heartbeatIntervalRef.current = setInterval(() => {
        sendHeartbeat(sessionToken);
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    }
  }, [sessionState, sessionToken, sendHeartbeat]);

  // Start session
  useEffect(() => {
    if (!videoId || !user || videos.length === 0 || sessionState !== 'idle') return;

    const video = videos.find(v => v.id === videoId);
    if (!video) {
      setErrorMessage("الفيديو المطلوب غير موجود.");
      setSessionState('error');
      return;
    }
    
    setCurrentVideo(video);
    setSessionState('starting');

    const start = async () => {
      try {
        const userAuthToken = await user.getIdToken();
        const response = await fetch('/api/start-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoID: videoId,
            userAuthToken: userAuthToken,
            extensionSecret: process.env.NEXT_PUBLIC_EXTENSION_SECRET,
          }),
        });

        const data = await response.json();
        if (data.success && data.sessionToken) {
          setSessionToken(data.sessionToken);
          setSessionState('watching');
          lastHeartbeatTime.current = Date.now();
        } else {
          throw new Error(data.error || 'Failed to start session');
        }
      } catch (err: any) {
        setErrorMessage('فشل في بدء الجلسة: ' + err.message);
        setSessionState('error');
      }
    };
    start();
  }, [videoId, videos, user, sessionState]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionState === 'watching' && sessionToken) {
        // Beacon is not reliable for complex logic, so we just cleanup
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        cleanup();
    };
  }, [sessionState, sessionToken, cleanup]);


  if (sessionState === 'idle' || sessionState === 'starting') {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4 flex-col gap-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">{sessionState === 'idle' ? 'جارٍ تحميل جلسة المشاهدة...' : 'جارٍ بدء الجلسة...'}</p>
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
    setTimeout(() => window.close(), 3000);

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
