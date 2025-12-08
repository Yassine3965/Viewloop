

'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-provider';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, Clock, MapPin, Loader2, PlayCircle, PlusCircle, Star, Sparkles, Gem } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const levelInfo = {
    1: { name: "أساسي", points: 0.05, gems: 0 },
    2: { name: "المستوى 2", points: 0.1, gems: 100 },
    3: { name: "المستوى 3", points: 0.2, gems: 200 },
    4: { name: "المستوى 4", points: 0.3, gems: 300 },
    5: { name: "المستوى 5", points: 0.5, gems: 400 },
};

const reputationInfo: { [key: number]: { text: string; stars: number } } = {
    1: { text: "ضعيفة", stars: 1 },
    2: { text: "متوسطة", stars: 2 },
    3: { text: "جيدة", stars: 3 },
    4: { text: "قوية", stars: 4 },
    5: { text: "قوية جداً", stars: 5 },
};

function ReputationDisplay({ reputation }: { reputation: number }) {
    const roundedReputation = Math.max(1, Math.min(5, Math.round(reputation)));
    const info = reputationInfo[roundedReputation];

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                    <Star
                        key={i}
                        className={cn(
                            "h-5 w-5",
                            i < info.stars
                                ? "text-amber-400 fill-amber-400"
                                : "text-muted-foreground/50"
                        )}
                    />
                ))}
            </div>
            <span className="text-sm font-semibold">{info.text}</span>
        </div>
    );
}

function LevelDisplay({ currentLevel }: { currentLevel: number }) {
    return (
        <div className="flex items-center justify-center gap-2 md:gap-4">
            {Object.entries(levelInfo).map(([level, info]) => (
                <TooltipProvider key={level}>
                    <Tooltip>
                        <TooltipTrigger>
                            <div
                                className={cn(
                                    "flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                    Number(level) === currentLevel
                                        ? "bg-primary/20 text-primary scale-110"
                                        : "opacity-60"
                                )}
                            >
                                <Sparkles className="h-6 w-6" />
                                <span className="text-xs font-bold">{info.name}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{info.points} نقطة/ثانية</p>
                            {Number(level) > 1 && <p>يتطلب {info.gems} جوهرة</p>}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ))}
        </div>
    );
}

export default function DashboardPage() {
  const { user, isUserLoading, logout } = useApp();
  const router = useRouter();
  
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push(`/login`);
      return;
    }
  }, [user, isUserLoading, router]);

  const isLoading = isUserLoading || !user;

  if (isLoading) {
    return (
      <main className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </main>
    );
  }
  
  if (!user) {
    return (
      <main className="flex h-[80vh] items-center justify-center">
        <div className='text-center'>
            <p className='text-destructive'>لم يتم العثور على ملف تعريف المستخدم.</p>
            <Button onClick={logout} variant="link">تسجيل الخروج</Button>
        </div>
      </main>
    );
  }

  const canCreateCampaign = user.emailVerified;

  return (
    <>
    <main className="flex-1 bg-muted/20 p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        
        <Card className="overflow-hidden shadow-lg">
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6">
                    {/* User Info */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-24 w-24 border-4 border-card ring-4 ring-primary">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl font-bold">{user.name}</h1>
                            <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className='text-sm w-fit'>
                                {user.role === 'admin' ? "مسؤول" : "مستخدم"}
                            </Badge>
                        </div>
                    </div>

                    {/* Levels */}
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground">المستوى</span>
                        <LevelDisplay currentLevel={user.level} />
                    </div>

                    {/* Reputation */}
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground">السمعة</span>
                        <ReputationDisplay reputation={user.reputation} />
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="hover:shadow-lg transition-shadow flex flex-col">
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <PlusCircle className="h-6 w-6 text-primary" />
                    <span>إنشاء حملة إعلانية جديدة</span>
                </CardTitle>
                <CardDescription>
                    أضف الفيديو الخاص بك ليبدأ الآخرون بمشاهدته وتفاعلهم معه.
                    {!user.emailVerified && <span className="text-destructive font-semibold block mt-1">يجب تفعيل حسابك أولاً.</span>}
                    {user.emailVerified && user.points <= 0 && <span className="text-destructive font-semibold block mt-1">ليس لديك نقاط كافية لإنشاء حملة.</span>}
                </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end">
                <Button asChild className={cn("w-full", user.points > 0 ? "bg-success hover:bg-success/90" : "bg-gray-400 cursor-not-allowed hover:bg-gray-400")} disabled={!canCreateCampaign || user.points <= 0}>
                    <Link href={`/campaign`}>ابدأ الآن</Link>
                </Button>
                </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow flex flex-col">
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="h-6 w-6 text-primary" />
                    <span>شاهد واكسب</span>
                </CardTitle>
                <CardDescription>
                    شاهد فيديوهات المستخدمين الآخرين.
                </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end">
                <Button asChild className="w-full">
                    <Link href={`/watch`}>تصفح الفيديوهات</Link>
                </Button>
                </CardContent>
            </Card>
        </div>

      </div>
    </main>
    </>
  );
}
