
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


const levelInfo: { [key: number]: { name: string; activityPulse: number; systemCapacity: number; icon: React.ElementType; color: string; bgColor: string; } } = {
    1: { name: "Standard", activityPulse: 0.05, systemCapacity: 0, icon: Sparkles, color: "text-slate-500", bgColor: "bg-slate-500/10" },
    2: { name: "Bronze Wave", activityPulse: 0.1, systemCapacity: 100, icon: Waves, color: "text-amber-600", bgColor: "bg-amber-600/10" },
    3: { name: "Silver Pulse", activityPulse: 0.2, systemCapacity: 200, icon: HeartPulse, color: "text-slate-400", bgColor: "bg-slate-400/10" },
    4: { name: "Golden Storm", activityPulse: 0.3, systemCapacity: 300, icon: Zap, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    5: { name: "Titan Flame", activityPulse: 0.5, systemCapacity: 400, icon: Flame, color: "text-red-500", bgColor: "bg-red-500/10" },
};

const reputationInfo: { [key: number]: { text: string; stars: number } } = {
    1: { text: "Basic", stars: 1 },
    2: { text: "Reliable", stars: 2 },
    3: { text: "Verified", stars: 3 },
    4: { text: "Enterprise", stars: 4 },
    5: { text: "Authoritative", stars: 5 },
};

function ReputationDisplay({ user, onImprove, isImproving }: { user: any, onImprove: () => void, isImproving: boolean }) {
    const reputation = user?.reputation ?? 4;
    const roundedReputation = Math.max(1, Math.min(5, Math.round(reputation)));
    const info = reputationInfo[roundedReputation];

    // Disabled on web to protect sensitive capacity data
    const canImprove = false;

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
                            Optimize
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Reputation Optimization</AlertDialogTitle>
                            <AlertDialogDescription>
                                Requesting <span className="font-bold text-primary">Protocol Optimization</span> to enhance verification level? (Processed via secure channel only)
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={onImprove} disabled={isImproving}>
                                {isImproving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
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
                                <p>Activity Protocol Level {levelKey}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
        </div>
    );
}



function ExtensionConnectButton() {
    const { getConnectionToken } = useApp();
    const [status, setStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

    const handleCopyToken = async () => {
        setStatus('copying');
        const token = await getConnectionToken();
        if (token) {
            navigator.clipboard.writeText(token);
            setStatus('copied');
            setTimeout(() => setStatus('idle'), 2000);
        } else {
            setStatus('idle');
            alert("Failed to retrieve token. Please authenticate again.");
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 text-xs h-7" onClick={handleCopyToken}>
                        <Zap className={cn("h-3 w-3", status === 'copied' ? "text-green-500" : "text-sky-500")} />
                        <span className={status === 'copied' ? "text-green-500" : ""}>
                            {status === 'copied' ? "Copied!" : "Manual Link"}
                        </span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Copy token to extension if automatic synchronization fails</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
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
                    <p className='text-destructive'>User profile not found.</p>
                    <Button onClick={logout} variant="link">Sign Out</Button>
                </div>
            </main>
        );
    }

    const canCreateCampaign = user.emailVerified;

    const lastLoginDate = user.lastLogin?.toDate ? formatDistanceToNow(user.lastLogin.toDate(), { addSuffix: true }) : 'Unknown';
    const creationDate = user.createdAt?.toDate ? format(user.createdAt.toDate(), 'PPP') : 'Unknown';

    return (
        <main className="flex-1 bg-background relative overflow-hidden pb-12">
            {/* Background Decorative Blobs */}
            <div className="absolute top-0 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-40 -left-20 w-80 h-80 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto max-w-6xl space-y-8 p-4 md:p-8 animate-scale-in relative z-10">

                {/* User Header Card */}
                <Card className="overflow-hidden glass-card border-white/5 shadow-2xl">
                    <CardContent className="p-6 md:p-10">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
                            {/* User Info & Levels */}
                            <div className="flex flex-col md:flex-row items-center gap-8 flex-1 w-full">
                                <div className="flex flex-col sm:flex-row items-center gap-6">
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                        <Avatar className="h-28 w-28 border-4 border-background ring-2 ring-white/10 relative">
                                            <AvatarImage src={user.avatar} alt={user.name} />
                                            <AvatarFallback className="text-3xl bg-transparent">
                                                <img src="/logo.png" alt="Logo" className="h-full w-full rounded-full" />
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col gap-2 items-center sm:items-start text-center sm:text-right">
                                        <div className="flex items-center gap-3">
                                            <h1 className="text-3xl font-extrabold tracking-tight">{user.name}</h1>
                                            <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="rounded-full px-3 py-1 text-xs">
                                                {user.role === 'admin' ? "Administrator" : "Verified Entity"}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                                <div className='flex-1 lg:border-r border-white/10 lg:pr-8 w-full'>
                                    <LevelDisplay currentLevel={user.level} />
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-6 pt-8 lg:pt-0 lg:border-l border-white/10 border-dashed w-full lg:w-72 lg:pl-10">
                                <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col items-center group/status hover:bg-white/10 transition-colors">
                                    <HeartPulse className="h-8 w-8 text-sky-400 mb-3 animate-pulse" />
                                    <span className="text-sm font-bold text-sky-400 uppercase tracking-widest">Client State: Synchronized</span>
                                    <span className="text-[10px] text-muted-foreground mt-1">Real-time Session Monitoring Active</span>
                                </div>

                                <div className="w-full space-y-3">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Auth Level</span>
                                        <span className="text-xs font-outfit font-bold text-primary">{user.reputation?.toFixed(1)} / 5.0</span>
                                    </div>
                                    <ReputationDisplay user={user} onImprove={handleImproveReputation} isImproving={isImproving} />
                                    <div className="pt-4 flex justify-center border-t border-white/5">
                                        <ExtensionConnectButton />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className='bg-primary/5 p-5 border-t border-white/5'>
                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm text-muted-foreground/80">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-background/50 rounded-lg">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <span className="font-medium">{user.city || 'Unknown'}, {user.country}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-background/50 rounded-lg">
                                    <Calendar className="h-4 w-4" />
                                </div>
                                <span className="font-medium">Joined {creationDate}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-background/50 rounded-lg">
                                    <Clock className="h-4 w-4" />
                                </div>
                                <span className="font-medium">Last Sync {lastLoginDate}</span>
                            </div>
                        </div>
                    </CardFooter>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card className="glass group hover:border-primary/50 transition-all duration-500 flex flex-col shadow-xl overflow-hidden shine-effect">
                        <CardHeader className="relative z-10">
                            <CardTitle className="flex items-center gap-3 text-xl font-bold">
                                <div className="p-3 bg-primary/20 rounded-2xl text-primary ring-1 ring-primary/30 group-hover:scale-110 transition-transform">
                                    <PlusCircle className="h-7 w-7" />
                                </div>
                                <span>Initialize Activity Sync</span>
                            </CardTitle>
                            <CardDescription className="pt-2 text-base leading-relaxed">
                                Document your digital presence by synchronizing a new activity log.
                                {!user.emailVerified && <span className="text-destructive font-bold block mt-2 animate-pulse">⚠️ Please verify your account.</span>}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow relative z-10">
                            <Button
                                asChild
                                className={cn(
                                    "w-full h-14 text-lg font-bold rounded-2xl transition-all shadow-[0_10px_20px_-10px_rgba(34,197,94,0.3)]",
                                    canCreateCampaign ? "bg-success hover:bg-success/90 hover:shadow-success/40" : "bg-muted cursor-not-allowed opacity-50"
                                )}
                                disabled={!canCreateCampaign}
                            >
                                <Link href={`/campaign`}>Start New Session</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="glass group hover:border-accent/50 transition-all duration-500 flex flex-col shadow-xl overflow-hidden shine-effect" style={{ '--shine-delay': '1s' } as any}>
                        <CardHeader className="relative z-10">
                            <CardTitle className="flex items-center gap-3 text-xl font-bold">
                                <div className="p-3 bg-accent/20 rounded-2xl text-accent ring-1 ring-accent/30 group-hover:scale-110 transition-transform">
                                    <PlayCircle className="h-7 w-7" />
                                </div>
                                <span>Explore Open Protocols</span>
                            </CardTitle>
                            <CardDescription className="pt-2 text-base leading-relaxed">
                                Contribute to data synchronization and expand digital activity coverage.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow relative z-10">
                            <Button asChild className="w-full h-14 text-lg font-bold rounded-2xl premium-gradient hover:opacity-90 shadow-[0_10px_20px_-10px_rgba(139,92,246,0.3)]">
                                <Link href={`/watch`}>Begin Sync Now</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </main>
    );
}
