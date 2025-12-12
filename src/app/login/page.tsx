'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        width="1.2rem"
        height="1.2rem"
        {...props}
      >
        <path
          fill="#FFC107"
          d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
        />
        <path
          fill="#FF3D00"
          d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
        />
        <path
          fill="#1976D2"
          d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.022,35.138,44,30.025,44,24C44,22.659,43.862,21.35,43.611,20.083z"
        />
      </svg>
    );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { user, isUserLoading, login, loginWithGoogle } = useApp();
  const router = useRouter();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!isUserLoading && user) {
      router.push(`/dashboard`);
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email && !password) {
      toast({
        title: "خطأ في الإدخال",
        description: "الرجاء إدخال البريد الإلكتروني وكلمة المرور.",
        variant: 'destructive',
      });
      return;
    }

    if (!email) {
      toast({
          title: "خطأ في الإدخال",
          description: "الرجاء إدخال البريد الإلكتروني.",
          variant: 'destructive',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        toast({
            title: "خطأ في الإدخال",
            description: "البريد الالكتروني غير صالح",
            variant: 'destructive',
        });
        return;
    }

    if (!password) {
      toast({
          title: "خطأ في الإدخال",
          description: "الرجاء إدخال كلمة المرور.",
          variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    const success = await login(email, password);
    if (success) {
      toast({ title: "تم تسجيل الدخول بنجاح!" });
      router.push(`/dashboard`);
    } else {
      toast({
        title: "فشل تسجيل الدخول",
        description: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const success = await loginWithGoogle();
    if (success) {
      toast({ title: "تم تسجيل الدخول بنجاح!" });
      router.push(`/dashboard`);
    } else {
        toast({
            title: "فشل تسجيل الدخول",
            description: "حدث خطأ أثناء محاولة تسجيل الدخول باستخدام جوجل.",
            variant: 'destructive',
        });
    }
    setIsGoogleLoading(false);
  };

  if (isUserLoading || user) {
    return (
        <main className="container flex h-screen items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
    );
  }

  return (
    <main className="container flex items-center justify-center py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>تسجيل الدخول</CardTitle>
          <CardDescription>أدخل بريدك الإلكتروني وكلمة المرور لتسجيل الدخول</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              تسجيل الدخول
            </Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">أو المتابعة باستخدام</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isGoogleLoading}>
             {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             ) : (
                <GoogleIcon className="mr-2 h-4 w-4" />
             )}
             Google
          </Button>

        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <p>ليس لديك حساب؟ <Link href="/register" className="font-semibold text-primary hover:underline">
            إنشاء حساب
          </Link></p>
        </CardFooter>
      </Card>
    </main>
  );
}
