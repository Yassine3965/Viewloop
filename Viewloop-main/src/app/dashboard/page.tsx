
'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-provider';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, Clock, MapPin, Loader2, PlayCircle, PlusCircle, Star, Sparkles, Gem, ArrowUp, Waves, HeartPulse, Zap, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
  

const levelInfo: { [key: number]: { name: string; points: number; gems: number; icon: React.ElementType; color: string; bgColor: string; } } = {
    1: { name: "أساسي", points: 0.05, gems: 0, icon: Sparkles, color: "text-slate-500", bgColor: "bg-slate-500/10" },
    2: { name: "Bronze Wave", points: 0.1, gems: 100, icon: Waves, color: "text-amber-600", bgColor: "bg-amber-600/10" },
    3: { name: "Silver Pulse", points: 0.2, gems: 200, icon: HeartPulse, color: "text-slate-400", bgColor: "bg-slate-400/10" },
    4: { name: "Golden Storm", points: 0.3, gems: 300, icon: Zap, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    5: { name: "Titan Flame", points: 0.5, gems: 400, icon: Flame, color: "text-red-500", bgColor: "bg-red-500/10" },
};

const reputationInfo: { [key: number]: { text: string; stars: number } } = {
    1: { text: "ضعيفة", stars: 1 },
    2: { text: "متوسطة", stars: 2 },
    3: { text: "جيدة", stars: 3 },
    4: { text: "قوية", stars: 4 },
    5: { text: "قوية جداً", stars: 5 },
};

function ReputationDisplay({ user, onImprove, isImproving }: { user: any, onImprove: () => void, isImproving: boolean }) {
    const reputation = user?.reputation ?? 4;
    const roundedReputation = Math.max(1, Math.min(5, Math.round(reputation)));
    const info = reputationInfo[roundedReputation];

    const canImprove = reputation < 5 && user?.gems >= 50;

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
            <div className='flex items-center gap-2'>
                <span className="text-sm font-semibold">{info.text}</span>
                <span className="text-xs font-mono text-muted-foreground">({reputation.toFixed(1)})</span>
            </div>

            {reputation < 5 && (
                 <AlertDialog>
                 <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!canImprove || isImproving}>
                        <ArrowUp className="ml-1 h-3 w-3" />
                        تحسين
                    </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>تأكيد تحسين السمعة</AlertDialogTitle>
                     <AlertDialogDescription>
                       هل أنت متأكد أنك تريد إنفاق <span className="font-bold text-primary">50 جوهرة</span> لزيادة سمعتك بمقدار <span className="font-bold text-primary">0.5</span>؟
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel>إلغاء</AlertDialogCancel>
                     <AlertDialogAction onClick={onImprove} disabled={isImproving}>
                        {isImproving ? <Loader2 className="h-4 w-4 animate-spin"/> : "تأكيد"}
                     </AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>
            )}
        </div>
    );
}

function LevelDisplay({ currentLevel }: { currentLevel: number }) {
    const level = currentLevel || 1;
    return (
        <div className="flex items-center justify-center gap-2 md:gap-4 p-2 rounded-lg">
            {Object.entries(levelInfo).map(([levelKey, info]) => {
                const Icon = info.icon;
                return (
                    <TooltipProvider key={levelKey}>
                        <Tooltip>
                            <TooltipTrigger>
                                <div
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                        Number(levelKey) === level
                                            ? `${info.bgColor} ${info.color} scale-110 shadow-lg`
                                            : "opacity-50 grayscale"
                                    )}
                                >
                                    <Icon className={cn("h-6 w-6", info.color)} />
                                    <span className={cn("text-xs font-bold", Number(levelKey) === level ? info.color : 'text-muted-foreground')}>
                                        {info.name}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{info.points} نقطة/ثانية</p>
                                {Number(levelKey) > 1 && <p>يتطلب {info.gems} جوهرة</p>}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
        </div>
    );
}

export default function DashboardPage() {
  const { user, isUserLoading, logout, improveReputation } = useApp();
  const router = useRouter();
  const [isImproving, setIsImproving] = useState(false);

  const handleImproveReputation = async () => {
    setIsImproving(true);
    await improveReputation();
    setIsImproving(false);
  }
  
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
  
  const lastLoginDate = user.lastLogin?.toDate ? formatDistanceToNow(user.lastLogin.toDate(), { addSuffix: true, locale: ar }) : 'غير معروف';
  const creationDate = user.createdAt?.toDate ? format(user.createdAt.toDate(), 'PPP', { locale: ar }) : 'غير معروف';

  return (
    <>
    <main className="flex-1 bg-muted/20 p-4 md:p-8">
      <div className="container mx-auto max-w-6xl space-y-8">
        
        <Card className="overflow-hidden shadow-lg">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* User Info & Levels */}
                    <div className="flex flex-col md:flex-row items-center gap-6 flex-1">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <Avatar className="h-24 w-24 border-4 border-card ring-4 ring-primary">
                                <AvatarImage src={user.avatar} alt={user.name} />
                                <AvatarFallback>{user.name.trim().charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-1 items-center sm:items-start">
                                <h1 className="text-2xl font-bold">{user.name}</h1>
                                <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className='text-sm w-fit'>
                                    {user.role === 'admin' ? "مسؤول" : "مستخدم"}
                                </Badge>
                            </div>
                        </div>
                        <div className='flex-1 md:border-r md:pr-6 md:mr-6'>
                            <LevelDisplay currentLevel={user.level} />
                        </div>
                    </div>

                    {/* Reputation */}
                    <div className="flex flex-col items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-dashed w-full md:w-auto md:pl-6">
                        <span className="text-sm font-bold text-muted-foreground">السمعة</span>
                        <ReputationDisplay user={user} onImprove={handleImproveReputation} isImproving={isImproving} />
                    </div>
                </div>
            </CardContent>
            <CardFooter className='bg-muted/30 p-4 border-t'>
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className='truncate'>{user.email}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{user.city || 'غير معروف'}, {user.country}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>انضم في {creationDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>آخر ظهور {lastLoginDate}</span>
                    </div>
                </div>
            </CardFooter>
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
