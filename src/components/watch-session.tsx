
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/app-provider';
import type { Video, Session } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Progress } from './ui/progress';
import { Loader2, XCircle, AlertTriangle, CheckCircle, MonitorPlay, ShieldAlert, Send, Gem, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Textarea } from './ui/textarea';

type SessionState = 'idle' | 'starting' | 'watching' | 'completing' | 'error' | 'done';

interface FinalState {
  status: 'suspicious' | 'completed' | 'finalized';
  activityPulse: number;
  systemCapacity: number;
  penaltyReasons: string[];
  qualityMessage?: string;
}

const reasonTranslations: { [key: string]: string } = {
  'inactive_too_long': 'Tab inactive for extended period.',
  'heartbeat_missing': 'Connection to server interrupted.'
};

export function WatchSession() {
  const searchParams = useSearchParams();
  const { user } = useApp();
  const { toast } = useToast();

  const videoId = searchParams.get('videoId');

  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [sessionData, setSessionData] = useState<Partial<Session> | null>(null);
  const [progress, setProgress] = useState(0);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [finalState, setFinalState] = useState<FinalState | null>(null);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

  const youtubeTabRef = useRef<Window | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const completeSession = useCallback(async (token: string, isBeacon = false) => {
    if (!token || sessionState === 'completing' || sessionState === 'done') return;

    setSessionState('completing');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

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
          activityPulse: data.activityPulse || 0,
          systemCapacity: data.systemCapacity || 0,
          penaltyReasons: data.penaltyReasons || [],
          qualityMessage: data.qualityMessage
        });
        setSessionState('done');
      } else {
        throw new Error(data.message || 'Failed to complete session');
      }
    } catch (error: any) {
      setErrorMessage('Session completion failed: ' + error.message);
      setSessionState('error');
    }
  }, [sessionState]);

  // Effect to poll session status from the server
  useEffect(() => {
    if (sessionState !== 'watching' || !sessionToken || !user) return;

    const pollStatus = async () => {
      try {
        const userAuthToken = await user.getIdToken();
        const response = await fetch('/api/session-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken, userAuthToken }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.session) {
          setSessionData(data.session);

          if (data.session.status === 'completed' || data.session.status === 'expired' || data.session.status === 'suspicious') {
            // The redundant check that caused the build error has been removed here.
            // If we are in the 'watching' state and the server says it's over, we complete it.
            completeSession(sessionToken);
          }
        }
      } catch (error: any) {
        console.error("Error polling session status:", error);
        if (error.message === 'INVALID_SESSION') {
          setErrorMessage("Session expired or invalid.");
          setSessionState('error');
        }
      }
    };

    // Poll immediately on start
    pollStatus();
    // Then poll every 3 seconds
    intervalRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };

  }, [sessionState, sessionToken, user, completeSession]);

  // Effect to update progress bar based on sessionData
  useEffect(() => {
    if (sessionData && currentVideo && currentVideo.duration > 0) {
      const watchedSeconds = sessionData.totalWatchedSeconds || 0;
      const newProgress = (watchedSeconds / currentVideo.duration) * 100;
      setProgress(Math.min(newProgress, 100));
    }
  }, [sessionData, currentVideo]);

  // Effect to start the whole flow
  useEffect(() => {
    async function startFlow() {
      if (sessionState !== 'idle' || !user || !videoId) {
        return;
      }

      setSessionState('starting');

      try {
        const userAuthToken = await user.getIdToken();
        const response = await fetch('/api/start-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-signature': 'INIT'
          },
          body: JSON.stringify({ videoId: videoId, userAuthToken }),
        });

        const data = await response.json();

        if (data.success && data.sessionToken && data.video) {
          setCurrentVideo(data.video as Video);
          setSessionToken(data.sessionToken);
          setSessionState('watching');

          const youtubeUrlWithToken = `${data.video.url}&autoplay=1&mute=1&sessionToken=${data.sessionToken}`;
          youtubeTabRef.current = window.open(youtubeUrlWithToken, '_blank');

          if (!youtubeTabRef.current) {
            throw new Error("فشل فتح نافذة يوتيوب. يرجى التأكد من السماح بالنوافذ المنبثقة.");
          }

        } else {
          throw new Error(data.message || 'Failed to start session');
        }
      } catch (err: any) {
        setErrorMessage(err.message);
        setSessionState('error');
        toast({
          title: 'Session Start Failed',
          description: err.message,
          variant: 'destructive',
        });
      }
    }

    startFlow();

  }, [sessionState, user, videoId, toast]);


  // Effect for page unload
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    };
  }, [sessionState, sessionToken, completeSession]);

  if (sessionState === 'idle' || sessionState === 'starting' || !currentVideo) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4 flex-col gap-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Preparing synchronization session...</p>
      </div>
    );
  }

  if (sessionState === 'error') {
    return (
      <div className="container py-8 text-center h-screen flex flex-col items-center justify-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Session Error</AlertTitle>
          <AlertDescription>{errorMessage || 'An unexpected error occurred.'}</AlertDescription>
        </Alert>
        <Button onClick={() => window.close()} className="mt-4">
          Close
        </Button>
      </div>
    );
  }

  if (sessionState === 'done' && finalState) {
    if (youtubeTabRef.current && !youtubeTabRef.current.closed) {
      youtubeTabRef.current.close();
    }

    if (finalState.activityPulse <= 0 && finalState.systemCapacity <= 0) {
      return (
        <div className="container py-8 text-center flex items-center justify-center h-screen">
          <div className='w-full max-w-sm'>
            <div className="bg-card rounded-lg shadow-lg border p-6 text-center">
              <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Insufficient Temporal Range</h2>
              <p className="text-muted-foreground mb-6">Minimum synchronization requirements not met for this session. Please ensure continuous activity for longer duration to validate compliance.</p>
              <Button onClick={() => window.close()} className="w-full mt-6" variant="secondary">
                Acknowledged
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (finalState.status === 'suspicious') {
      return (
        <div className="container py-8 text-center flex items-center justify-center h-screen">
          <Alert variant="destructive" className="max-w-md mx-auto">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Session Synchronization Suspended</AlertTitle>
            <AlertDescription>
              <p>Compliance data conflict detected for this session. Observation logged in technical audit registry.</p>
              <strong className='my-2 block'>Reasons:</strong>
              <ul className='list-disc list-inside text-left mb-4'>
                {finalState.penaltyReasons.map(r => <li key={r}>{reasonTranslations[r] || r}</li>)}
              </ul>
              {!showAppealForm ? (
                <div className='flex gap-2 mt-4'>
                  <Button onClick={() => window.close()} variant="secondary" className="flex-1">
                    Acknowledged
                  </Button>
                  <Button onClick={() => setShowAppealForm(true)} className="flex-1">
                    Submit Appeal
                  </Button>
                </div>
              ) : (
                <div className='mt-4 space-y-2 text-left'>
                  <label htmlFor="appeal" className='font-semibold text-sm'>Clarification:</label>
                  <Textarea
                    id="appeal"
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    placeholder='Explain why you believe this decision is incorrect...'
                  />
                  <Button className='w-full' disabled={!appealText || isSubmittingAppeal}>
                    {isSubmittingAppeal ? <Loader2 className='ml-2 h-4 w-4 animate-spin' /> : <Send className='ml-2 h-4 w-4' />}
                    Submit Appeal
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
            <h2 className="text-2xl font-bold mb-2">{finalState.qualityMessage || 'Synchronization Successful!'}</h2>
            <p className="text-muted-foreground mb-6">Viewing protocol completed successfully. Activity data documented and encrypted in cloud system.</p>
            <div className="space-y-3 text-left bg-primary/5 border border-primary/20 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <span className='text-sm font-bold text-primary'>Protocol Status:</span>
                <span className='text-sm font-bold text-primary'>VALIDATED & SECURE</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-primary/10">
                <span className='text-[10px] text-muted-foreground'>Session Signature:</span>
                <span className='text-[10px] font-mono text-muted-foreground'>{sessionToken?.substring(0, 16)}...</span>
              </div>
            </div>
            <Button onClick={() => window.close()} className="w-full mt-6">
              Excellent! Close
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
            {sessionState === 'completing' ? 'Verifying...' : 'Viewing Session Active'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {sessionState === 'completing' ? 'Validating viewing session now.' : 'Keep this window open while watching the video.'}
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <h3 className="text-base font-semibold truncate text-center">{currentVideo.title}</h3>
          <Progress value={progress} className="w-full h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Duration {currentVideo.duration}s</span>
            <span>{Math.round(sessionData?.totalWatchedSeconds || 0)} / {currentVideo.duration}s</span>
          </div>
        </div>

        {sessionState === 'watching' && sessionToken && (
          <div className="mt-6">
            <Button variant="destructive" className="w-full" onClick={() => completeSession(sessionToken)}>
              <XCircle className="mr-2 h-4 w-4" /> Early Termination
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
