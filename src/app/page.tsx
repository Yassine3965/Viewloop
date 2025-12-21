
'use client';

import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  PlayCircle,
  Eye,
  Star,
  TrendingUp,
  ArrowDown,
  ArrowUp,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/app-provider';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { user, isUserLoading } = useApp();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const heroSection = document.getElementById('hero');
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (isUserLoading) {
    return (
      <main className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </main>
    );
  }

  // This is the logic that was redirecting logged-in users.
  // It has been removed.
  /*
  if (user) {
    router.push('/dashboard');
    return (
        <main className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
      );
  }
  */

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section
        id="hero"
        className="w-full py-20 md:py-32 lg:py-40 bg-card/50 scroll-mt-16"
      >
        <div className="container px-4 md:px-6">
          <div className="flex flex-col justify-center space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-primary">
              إدارة ذكية لجلسات النشاط الرقمي
            </h1>
            <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              منصة ViewLoop توفر حلاً متكاملاً لمزامنة تفاعلاتك عبر منصات المحتوى المختلفة، مما يضمن تجربة متسقة ومنظمة لإدارة الجلسات الرقمية.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row justify-center">
              <Button asChild size="lg">
                <Link href={user ? "/dashboard" : "/register"}>
                  البدء الآن
                  <ArrowRight className="mr-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/about">
                  تعرف على النظام
                  <PlayCircle className="mr-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
            <div className="flex justify-center pt-12 animate-bounce">
              <Link href="#features" scroll={true} className="scroll-smooth">
                <ArrowDown className="h-8 w-8 text-muted-foreground cursor-pointer" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="w-full py-12 md:py-24 lg:py-32 bg-muted/20 scroll-mt-16"
      >
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
              أدوات متطورة لمزامنة وتحليل الجلسات
            </h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              نظامنا يركز على توفير بيانات دقيقة حول تفاعلات المستخدمين، مما يساعد في تحسين جودة النشاط الرقمي وتنظيمه بشكل احترافي.
            </p>
          </div>
          <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">مزامنة الحالة اللحظية</h3>
              <p className="text-sm text-muted-foreground">
                تقنية النبض (Pulse) تضمن مزامنة حالة الجلسة بدقة متناهية عبر مختلف المنصات، مما يضمن توثيق كافة بيانات النشاط الرقمي.
              </p>
            </div>
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Star className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">وحدات التقدم والنشاط</h3>
              <p className="text-sm text-muted-foreground">
                كسب وحدات تفصيلية تعكس مستوى التزام المستخدم واستمرارية النشاط، مما يساهم في بناء ملف شخصي موثوق.
              </p>
            </div>
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">تحليل البيانات والتقارير</h3>
              <p className="text-sm text-muted-foreground">
                تقارير شاملة حول وقت النشاط وأنماط التفاعل الرقمي، مما يساعد في تحسين الإنتاجية وفهم سلوك التصفح.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll to top button */}
      <Button
        variant="outline"
        size="icon"
        onClick={scrollToTop}
        className={cn(
          'fixed bottom-8 left-1/2 -translate-x-1/2 z-50 h-12 w-12 rounded-full transition-opacity duration-300',
          showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-label="العودة إلى الأعلى"
      >
        <ArrowUp className="h-6 w-6" />
      </Button>
    </main>
  );
}
