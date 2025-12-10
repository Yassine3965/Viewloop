'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/app-provider';
import type { Video } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Progress } from './ui/progress';
import { Loader2, XCircle, AlertTriangle, CheckCircle, MonitorPlay, ShieldAlert, Send, Gem, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Textarea } from './ui/textarea';

type SessionState = 'idle' | 'starting' | 'watching' | 'completing' | 'error' | 'done';

interface FinalState {
    status: 'suspicious' | 'completed' | 'finalized';
    points: number;
    gems: number;
    penaltyReasons: string[];
}

const reasonTranslations: { [key: string]: string } = {
    'inactive_too_long': 'تم ترك التبويبة غير نشطة لفترة طويلة.',
    'no_mouse_activity': 'لم يتم رصد أي حركة للماوس لفترة طويلة.',
    'heartbeat_missing': 'انقطع الاتصال بالخادم.'
};

export function WatchSession() {
  const searchParams = useSearchParams();
  const { videos, user } = useApp();
  const { toast } = useToast();

  const videoId = searchParams.get('videoId');

  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [progress, setProgress] = useState(0);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [totalWatchedSeconds, setTotalWatchedSeconds] = useState(0);
  const [finalState, setFinalState] = useState<FinalState | null>(null);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const youtubeTabRef = useRef<Window | null>(null);

  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
    }
  }, []);

  const completeSession = useCallback(async (token: string, isBeacon = false) => {
    if (!token || sessionState === 'completing' || sessionState === 'done') return;
  
    setSessionState('completing');
    cleanup();
  
    const payload = JSON.stringify({ sessionToken: token });
  
    if (isBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/complete', payload);
      return;
    }
  
    try {
      const response = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      const data = await response.json();
      if (data.success) {
        setFinalState({
          status: data.status,
          points: data.points,
          gems: data.gems,
          penaltyReasons: data.penaltyReasons || [],
        });
        setSessionState('done');
      } else {
        throw new Error(data.message || 'Failed to complete session');
      }
    } catch (error: any) {
      setErrorMessage('فشل في إنهاء الجلسة. ' + error.message);
      setSessionState('error');
    }
  }, [cleanup, sessionState]);

  useEffect(() => {
    if (sessionState === 'watching' && currentVideo && sessionToken) {
        if (totalWatchedSeconds >= currentVideo.duration) {
            setProgress(100);
            completeSession(sessionToken);
        } else {
            const newProgress = (totalWatchedSeconds / currentVideo.duration) * 100;
            setProgress(Math.min(newProgress, 100));
        }
    }
  }, [totalWatchedSeconds, currentVideo, sessionState, sessionToken, completeSession]);

  useEffect(() => {
    const handleHeartbeat = async (token: string) => {
        try {
            const res = await fetch('/api/heartbeat-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token }),
            });
            const data = await res.json();
    
            if (data.totalWatchedSeconds !== undefined) {
            setTotalWatchedSeconds(data.totalWatchedSeconds);
            }
    
            if (data.status === 'completed' || data.status === 'expired' || data.status === 'suspicious') {
                completeSession(token);
            }
        } catch (error) {
            console.error('Heartbeat from session page failed:', error);
            // Consider ending the session if heartbeats fail consistently
        }
    };
    
    if (sessionState === 'watching' && sessionToken) {
        heartbeatIntervalRef.current = setInterval(() => {
            handleHeartbeat(sessionToken);
        }, 15 * 1000); // Send heartbeat every 15 seconds
    }
  
    return cleanup;
  }, [sessionState, sessionToken, cleanup, completeSession]);


  useEffect(() => {
    async function startFlow() {
        if (sessionState !== 'idle' || !user || !videoId || videos.length === 0) {
            return;
        }

        setSessionState('starting');

        const videoToWatch = videos.find(v => v.id === videoId);
        if (!videoToWatch) {
            setErrorMessage("الفيديو المطلوب غير موجود.");
            setSessionState('error');
            return;
        }
        setCurrentVideo(videoToWatch);

        try {
            const userAuthToken = await user.getIdToken();
            const response = await fetch('/api/start-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoID: videoId, userAuthToken }),
            });

            const data = await response.json();

            if (data.success && data.sessionToken) {
                setSessionToken(data.sessionToken);
                setSessionState('watching');
                
                const youtubeUrlWithToken = `${videoToWatch.url}#VIEWLOOP_TOKEN=${data.sessionToken}`;
                youtubeTabRef.current = window.open(youtubeUrlWithToken, '_blank');

                if (!youtubeTabRef.current) {
                    throw new Error("فشل فتح نافذة يوتيوب. يرجى التأكد من السماح بالنوافذ المنبثقة.");
                }

            } else {
                throw new Error(data.message || 'فشل في بدء الجلسة');
            }
        } catch (err: any) {
            setErrorMessage(err.message);
            setSessionState('error');
            toast({
                title: 'فشل بدء الجلسة',
                description: err.message,
                variant: 'destructive',
            });
        }
    }

    startFlow();

  }, [sessionState, user, videos, videoId, toast]);


  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (sessionState === 'watching' && sessionToken) {
            completeSession(sessionToken, true);
        }
        if (youtubeTabRef.current && !youtubeTabRef.current.closed) {
            youtubeTabRef.current.close();
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        cleanup();
    };
  }, [sessionState, sessionToken, cleanup, completeSession]);

  if (sessionState === 'idle' || sessionState === 'starting' || !currentVideo) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4 flex-col gap-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">جارٍ تحضير جلسة المشاهدة...</p>
      </div>
    );
  }

  if (sessionState === 'error') {
    return (
      <div className="container py-8 text-center h-screen flex flex-col items-center justify-center">
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

  if (sessionState === 'done' && finalState) {
    if (youtubeTabRef.current && !youtubeTabRef.current.closed) {
        youtubeTabRef.current.close();
    }
    if (finalState.status === 'suspicious') {
        return (
            <div className="container py-8 text-center flex items-center justify-center h-screen">
                <Alert variant="destructive" className="max-w-md mx-auto">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>تم تعليق الجلسة</AlertTitle>
                    <AlertDescription>
                        <p>تم تصنيف هذه الجلسة على أنها مشبوهة. تم تطبيق عقوبة على النقاط والسمعة.</p>
                        <strong className='my-2 block'>الأسباب:</strong>
                        <ul className='list-disc list-inside text-right mb-4'>
                            {finalState.penaltyReasons.map(r => <li key={r}>{reasonTranslations[r] || r}</li>)}
                        </ul>
                        {!showAppealForm ? (
                             <div className='flex gap-2 mt-4'>
                                <Button onClick={() => window.close()} variant="secondary" className="flex-1">
                                    موافق وإغلاق
                                </Button>
                                <Button onClick={() => setShowAppealForm(true)} className="flex-1">
                                    تقديم طعن
                                </Button>
                             </div>
                        ) : (
                            <div className='mt-4 space-y-2 text-right'>
                                <label htmlFor="appeal" className='font-semibold text-sm'>توضيح الموقف:</label>
                                <Textarea 
                                    id="appeal"
                                    value={appealText}
                                    onChange={(e) => setAppealText(e.target.value)}
                                    placeholder='اشرح لماذا تعتقد أن هذا القرار غير صحيح...'
                                />
                                <Button className='w-full' disabled={!appealText || isSubmittingAppeal}>
                                    {isSubmittingAppeal ? <Loader2 className='ml-2 h-4 w-4 animate-spin' /> : <Send className='ml-2 h-4 w-4'/>}
                                    إرسال الطعن
                                </Button>
                            </div>
                        )}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
      return (
        <div className="container py-8 text-center flex items-center justify-center h-screen">
            <div className='w-full max-w-sm'>
                <div className="bg-card rounded-lg shadow-lg border p-6 text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">اكتملت الجلسة!</h2>
                    <p className="text-muted-foreground mb-6">لقد أكملت مشاهدة الفيديو بنجاح. إليك ملخص مكافآتك:</p>
                    <div className="space-y-3 text-right bg-muted/50 p-4 rounded-md">
                        <div className="flex justify-between items-center">
                            <span className='text-muted-foreground'>النقاط المكتسبة:</span>
                            <div className="flex items-center gap-2 font-bold text-lg text-amber-500">
                                <Star className="h-5 w-5 fill-current" />
                                <span>{finalState.points.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                             <span className='text-muted-foreground'>المجوهرات المكتسبة:</span>
                            <div className="flex items-center gap-2 font-bold text-lg text-sky-500">
                                <Gem className="h-5 w-5 fill-current" />
                                <span>{finalState.gems.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <Button onClick={() => window.close()} className="w-full mt-6">
                        رائع! إغلاق
                    </Button>
                </div>
            </div>
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
            <span>{Math.round(totalWatchedSeconds)} / {currentVideo.duration} ث</span>
          </div>
        </div>

        {sessionState === 'watching' && sessionToken && (
          <div className="mt-6">
            <Button variant="destructive" className="w-full" onClick={() => completeSession(sessionToken)}>
              <XCircle className="mr-2 h-4 w-4" /> إنهاء مبكر وإغلاق
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
