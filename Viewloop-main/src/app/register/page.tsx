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
import { Loader2, UserPlus, MailCheck } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('male');
  const [isLoading, setIsLoading] = useState(false);
  const { user, isUserLoading, registerAndSendCode } = useApp();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push(`/dashboard`);
    }
  }, [user, isUserLoading, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const emptyFields = [];
    if (!name) emptyFields.push('الاسم');
    if (!email) emptyFields.push('البريد الإلكتروني');
    if (!password) emptyFields.push('كلمة المرور');
    if (!confirmPassword) emptyFields.push('تأكيد كلمة المرور');

    if (emptyFields.length > 0) {
      toast({
        title: 'حقول فارغة',
        description: 'الرجاء ملء جميع الحقول المطلوبة.',
        variant: 'destructive',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'خطأ في الإدخال',
        description: 'البريد الالكتروني غير صالح',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'كلمة مرور قصيرة',
        description: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'كلمتا المرور غير متطابقتين.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const result = await registerAndSendCode({ name, email, password, gender });

    if (result.success) {
      setStep(2);
      toast({
        title: 'تم إرسال رابط التحقق',
        description:
          'لقد أرسلنا رابط تحقق إلى بريدك الإلكتروني. يرجى النقر عليه لتفعيل حسابك.',
      });
    } else {
      toast({
        title: 'فشل إنشاء الحساب',
        description:
          result.message || 'هذا البريد الإلكتروني مستخدم بالفعل أو حدث خطأ آخر.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  if (isUserLoading || user) {
    return (
      <main className="container flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </main>
    );
  }

  if (step === 2) {
    return (
      <main className="container flex items-center justify-center py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="mt-4">تحقق من بريدك الإلكتروني</CardTitle>
            <CardDescription>
              لقد أرسلنا رابط تحقق إلى <strong>{email}</strong>. الرجاء النقر
              على الرابط الموجود في البريد الإلكتروني لتفعيل حسابك.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Alert>
                <AlertTitle>لم تستلم البريد؟</AlertTitle>
                <AlertDescription>
                    تأكد من فحص مجلد الرسائل غير المرغوب فيها (Spam). يمكنك بعد ذلك المتابعة لتسجيل الدخول.
                </AlertDescription>
             </Alert>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button asChild className="w-full">
              <Link href="/login">الانتقال إلى صفحة تسجيل الدخول</Link>
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="container flex items-center justify-center py-16">
      <Card className="w-full max-w-md shadow-lg transition-shadow hover:shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-3">
            <UserPlus className="h-7 w-7 text-primary" />
            <CardTitle>إنشاء حساب جديد</CardTitle>
          </div>
          <CardDescription>أدخل معلوماتك لإنشاء حساب جديد</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <Input
                id="name"
                type="text"
                placeholder="اذخل الاسم"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              <Label>الجنس</Label>
              <RadioGroup
                defaultValue="male"
                onValueChange={setGender}
                className="flex items-center space-x-4"
                dir="rtl"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="g-male" />
                  <Label htmlFor="g-male" className="cursor-pointer">
                    ذكر
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="g-female" />
                  <Label htmlFor="g-female" className="cursor-pointer">
                    أنثى
                  </Label>
                </div>
              </RadioGroup>
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
            <div className="space-y-2">
              <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>{' '}
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              إنشاء حساب
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <p>
            هل لديك حساب بالفعل؟{' '}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              تسجيل الدخول
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
