'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock } from 'lucide-react';
import { useApp } from '@/lib/app-provider';

function SubmitButton({ disabled, onCalculate }: { disabled?: boolean, onCalculate: () => void }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      onCalculate();
    });
  };

  return (
    <Button type="button" onClick={handleClick} disabled={disabled || isPending} className="w-full">
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          جارٍ التحقق...
        </>
      ) : (
        "إضافة فيديو"
      )}
    </Button>
  );
}

type ConfirmationData = {
  title: string;
  url: string;
  duration: number;
} | null;

export default function CampaignForm() {
  const { toast } = useToast();
  const { user, addVideo, isUserLoading } = useApp();

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [durationManual, setDurationManual] = useState<number | ''>(60);
  const [errors, setErrors] = useState<{ title?: string, url?: string; }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<ConfirmationData>(null);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!title || title.length < 3) {
      newErrors.title = "يجب أن يكون العنوان 3 أحرف على الأقل.";
    }

    try {
      if (!url) throw new Error("URL فارغ");
      const parsedUrl = new URL(url);
      if (!parsedUrl.hostname.includes('youtube.com') && !parsedUrl.hostname.includes('youtu.be')) {
        newErrors.url = "الرجاء إدخال رابط يوتيوب صالح.";
      }
    } catch (_) {
      newErrors.url = "الرجاء إدخال رابط يوتيوب صالح.";
    }

    // Duration is now server-side verified, client input is a secondary suggestion or can be ignored.
    // We'll keep a basic check for form sanity but server has final word.

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setDurationManual(60);
    setErrors({});
  };

  const handleCalculateAndConfirm = () => {
    if (!validateForm()) {
      toast({
        title: "خطأ في الإدخال",
        description: "يرجى مراجعة الحقول وإصلاح الأخطاء.",
        variant: 'destructive'
      });
      return;
    }

    setConfirmationData({
      title,
      url,
      duration: 0, // Server will fetch accurate duration
    });
    setShowConfirmation(true);
  };


  const handleConfirmSubmit = async () => {
    if (!confirmationData || !user) return;

    setIsSubmitting(true);

    const { title, url, duration } = confirmationData;

    const result = await addVideo({
      title,
      url,
      duration,
      submitterId: user.id
    });

    if (result.success) {
      toast({
        title: "نجاح!",
        description: result.message,
      });
      resetForm();
    } else {
      toast({
        variant: "destructive",
        title: "فشل إنشاء الحملة",
        description: result.message,
      });
    }

    setIsSubmitting(false);
    setShowConfirmation(false);
    setConfirmationData(null);
  };

  if (isUserLoading) {
    return <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto my-16" />;
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>إنشاء حملة جديدة</CardTitle>
          <CardDescription>
            أدخل رابط فيديو يوتيوب وعنوانًا لإضافته إلى قائمة الانتظار ليشاهده الآخرون.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <input type="hidden" name="userId" value={user?.id || ''} />
            <div className="space-y-2">
              <Label htmlFor="title">عنوان الفيديو</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              {errors.title && (
                <p className="text-sm font-medium text-destructive">
                  {errors.title}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">رابط يوتيوب</Label>
              <Input
                id="url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                type="url"
              />
              {errors.url && (
                <p className="text-sm font-medium text-destructive">
                  {errors.url}
                </p>
              )}
            </div>

            <div className="space-y-2 p-3 bg-primary/5 rounded-md border border-primary/20">
              <Label className='flex items-center gap-2 text-primary'>
                <Clock className="w-4 h-4" />
                مدة الفيديو (تلقائية)
              </Label>
              <p className="text-xs text-muted-foreground">
                سيقوم النظام تلقائياً بجلب مدة الفيديو الدقيقة من يوتيوب لضمان عدالة توزيع النقاط.
              </p>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4 p-6 pt-4">
          <SubmitButton onCalculate={handleCalculateAndConfirm} disabled={isSubmitting} />
        </CardFooter>
      </Card>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تفاصيل الحملة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد أنك تريد إضافة هذا الفيديو؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-3 text-sm bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className='flex items-center gap-2 text-primary font-bold'>
                <Sparkles className="w-4 h-4" />
                <span>سيتم جلب المدة الحقيقية تلقائياً</span>
              </div>
            </div>
            <div className="flex items-start justify-between">
              <div className='flex items-center gap-2 text-muted-foreground'>
                <svg xmlns="http://www.w3.org/2000/svg" className='w-4 h-4' viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 0 0 9-9h-9v9Z" /><path d="M12 3a9 9 0 0 1 9 9h-9V3Z" /><path d="M12 12a9 9 0 0 1-9-9h9v9Z" /><path d="M12 12a9 9 0 0 0-9 9h9v-9Z" /></svg>
                <span>عنوان الفيديو</span>
              </div>
              <div className='font-semibold text-right max-w-[70%] truncate'>{confirmationData?.title}</div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  جارٍ الإنشاء...
                </>
              ) : (
                "تأكيد وإنشاء الحملة"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
