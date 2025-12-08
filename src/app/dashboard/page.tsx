

'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-provider';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, Clock, MapPin, Loader2, PlayCircle, PlusCircle, Trash2 } from 'lucide-react';
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

export default function DashboardPage() {
  const { user, isUserLoading, logout } = useApp();
  const router = useRouter();
  const [showEmail, setShowEmail] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
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

  const formatDate = (date: any) => {
    if (!date) return "غير متاح";
    try {
      let dateObj;
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) {
          return "تاريخ غير صالح";
      }
      return format(dateObj, 'PP', { locale: ar });
    } catch (error) {
      return "تاريخ غير صالح";
    }
  };
  
  const formatLastSeen = (date: any) => {
    if (!date) return "غير متاح";
    try {
        let dateObj;
        if (date && typeof date.toDate === 'function') {
            dateObj = date.toDate();
        } else {
            dateObj = new Date(date);
        }
        
        if (isNaN(dateObj.getTime())) {
            return "تاريخ غير صالح";
        }

        const now = new Date();
        const diffMinutes = Math.round((now.getTime() - dateObj.getTime()) / 60000);

        if (diffMinutes < 5) {
            return "نشط الآن";
        }

        const distance = formatDistanceToNow(dateObj, { addSuffix: true, locale: ar });
        // Arabic-specific fix for "about" prefix which can be redundant
        return distance.replace(/^قبل حوالي /, 'قبل ');

    } catch (error) {
        return "تاريخ غير صالح";
    }
};

  const canCreateCampaign = user.emailVerified;

  return (
    <>
    <main className="flex-1 bg-muted/20 p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        
        <Card className="overflow-hidden shadow-lg">
          <CardHeader className="bg-card p-6 border-b">
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
          </CardHeader>
          <CardContent className='p-6 flex justify-between items-start text-sm'>
            <div className="flex flex-col items-start gap-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowEmail(!showEmail)}>
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    {showEmail && (
                        <span className="text-muted-foreground">{user.email}</span>
                    )}
                </div>
                {user.country && (
                    <div className="flex items-center text-sm text-muted-foreground gap-3">
                        <MapPin className="h-5 w-5" />
                        <span>{user.country}</span>
                    </div>
                )}
            </div>
            <div className='flex flex-col items-end gap-2 text-right'>
                <div className="flex items-center gap-3">
                <span>{formatLastSeen(user.lastLogin)}</span>
                <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-3">
                <span>انضم في {formatDate(user.createdAt)}</span>
                <Calendar className="h-5 w-5 text-muted-foreground" />
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
