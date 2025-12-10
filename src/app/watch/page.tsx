'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Video } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Loader2, Trash2, Search } from 'lucide-react';
import { getYoutubeThumbnailUrl } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
  } from "@/components/ui/alert-dialog"
import { useApp } from '@/lib/app-provider';
import { useState, useEffect, useMemo, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

function VideoCard({ video, user, onDelete }: { video: Video, user: ReturnType<typeof useApp>['user'], onDelete: (video: Video) => void }) {
  const isOwner = user && user.id === video.submitterId;
  const thumbnailUrl = getYoutubeThumbnailUrl(video.url);
  const { toast } = useToast();

  const handleWatchClick = () => {
    if (!user) {
        toast({ title: "خطأ", description: "يجب تسجيل الدخول لبدء المشاهدة.", variant: "destructive" });
        return;
    }
    const sessionUrl = `/watch/session?videoId=${video.id}`;
    window.open(sessionUrl, '_blank');
  };

  return (
    <Card className="h-full flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300 bg-card overflow-hidden group">
      <div 
        onClick={handleWatchClick}
        className="relative aspect-video bg-muted hover:bg-muted/80 flex items-center justify-center cursor-pointer"
      >
        {thumbnailUrl && (
            <Image
                src={thumbnailUrl}
                alt={video.title}
                fill
                className="object-cover"
            />
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              className="w-16 h-16 bg-primary/80 rounded-full flex items-center justify-center text-white"
              aria-label={`Play video: ${video.title}`}
            >
              <Play className="w-8 h-8 fill-white" />
            </Button>
        </div>
      </div>
      <CardContent className="p-4 flex-grow flex flex-col justify-center">
        <button
          onClick={handleWatchClick}
          className="block font-semibold text-base truncate hover:underline text-card-foreground text-right w-full"
          title={video.title}
        >
          {video.title}
        </button>
      </CardContent>
      {isOwner && (
         <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100 z-10">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                    سيؤدي هذا إلى حذف حملتك بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(video)}>
                    حذف
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
}

export default function WatchPage() {
  const { isUserLoading, user, videos, deleteVideo, searchQuery, setSearchQuery } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    if (!isUserLoading) {
      setIsLoading(false);
    }
    // Clear search on mount
    return () => setSearchQuery('');
  }, [isUserLoading, setSearchQuery]);

  const filteredVideos = useMemo(() => {
    if (!videos) return [];
    if (!searchQuery) return videos;
    return videos.filter(video => 
        video.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [videos, searchQuery]);

  const handleDelete = async (video: Video) => {
    const result = await deleteVideo(video);
    toast({
        title: result.success ? "نجاح" : "فشل",
        description: result.message,
        variant: result.success ? "default" : "destructive",
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="container py-8">
        <Alert className="max-w-xl mx-auto">
          <AlertTitle className="font-bold">
            الرجاء تسجيل الدخول
          </AlertTitle>
          <AlertDescription>
            يجب عليك تسجيل الدخول لمشاهدة مقاطع الفيديو.
            <div className="mt-4">
              <Button asChild>
                <Link href="/login">تسجيل الدخول</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">شاهد واكسب</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">اختر فيديو من القائمة أدناه لبدء المشاهدة.</p>
      </div>

      {videos && videos.length > 0 ? (
        <>
        {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredVideos.map(video => (
                    <VideoCard key={video.id} video={video} user={user} onDelete={handleDelete} />
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed rounded-lg">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">لا توجد نتائج بحث</h2>
                <p className="mt-2 text-muted-foreground">لم نتمكن من العثور على أي فيديوهات تطابق بحثك.</p>
                <Button variant="link" onClick={() => setSearchQuery('')}>امسح البحث</Button>
            </div>
        )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed rounded-lg">
           <h2 className="text-xl font-semibold">لا توجد فيديوهات متاحة</h2>
           <p className="mt-2 text-muted-foreground">لا توجد حاليًا مقاطع فيديو في قائمة الانتظار. تحقق مرة أخرى لاحقًا أو كن أول من يضيف واحدًا!</p>
           <Button asChild className="mt-6">
              <Link href="/campaign">أضف فيديو الآن</Link>
           </Button>
        </div>
      )}
    </main>
  );
}
