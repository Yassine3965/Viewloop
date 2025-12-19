'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase/provider';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function VerifyEmail() {
  const { auth } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!oobCode || mode !== 'verifyEmail') {
      setError('رابط التحقق غير صالح أو مفقود.');
      setStatus('error');
      return;
    }
    if (!auth) return;

    const handleVerifyEmail = async () => {
      try {
        // Confirm the action code is valid.
        await checkActionCode(auth, oobCode);
        
        // Apply the action code to verify the email.
        await applyActionCode(auth, oobCode);

        setStatus('success');
        toast({
          title: 'نجاح!',
          description: 'تم التحقق من بريدك الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول.',
        });
        
        // Redirect to login page after successful verification
        setTimeout(() => router.push('/login'), 3000);

      } catch (err: any) {
        switch (err.code) {
          case 'auth/expired-action-code':
            setError('انتهت صلاحية رمز التحقق. الرجاء طلب رابط جديد.');
            break;
          case 'auth/invalid-action-code':
            setError('رمز التحقق غير صالح. قد يكون تم استخدامه بالفعل.');
            break;
          default:
            setError('حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.');
            break;
        }
        setStatus('error');
      }
    };

    handleVerifyEmail();
  }, [oobCode, mode, auth, router, toast]);

  if (status === 'verifying') {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
            <CardTitle>جارٍ التحقق...</CardTitle>
        </CardHeader>
        <CardContent>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">يتم الآن التحقق من بريدك الإلكتروني.</p>
        </CardContent>
      </Card>
    );
  }

  if (status === 'success') {
    return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="mt-4">تم التحقق بنجاح!</CardTitle>
                <CardDescription>
                    تم التحقق من بريدك الإلكتروني. سيتم توجيهك إلى صفحة تسجيل الدخول قريبًا.
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }
  
  if (status === 'error') {
    return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                    <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="mt-4">فشل التحقق</CardTitle>
                <CardDescription>
                    {error}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/login">العودة إلى تسجيل الدخول</Link>
                </Button>
            </CardContent>
        </Card>
    );
  }

  return null;
}

export default function VerifyEmailPage() {
    return (
        <main className="container flex h-screen items-center justify-center">
            <Suspense fallback={<Loader2 className="h-16 w-16 animate-spin" />}>
                <VerifyEmail />
            </Suspense>
        </main>
    )
}
