
import { Button } from '@/components/ui/button';
import { ArrowRight, PlayCircle, Eye, Star } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 lg:py-40 bg-card/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col justify-center space-y-6 text-center">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-primary">
              شاهد أكثر، اكسب أكثر
              </h1>
              <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              ادعم منشئي المحتوى المفضلين لديك. منصة ViewLoop تكافئك على مشاهدة الإعلانات، مما يساعد أصحاب القنوات على زيادة أرباحهم.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row justify-center">
                <Button asChild size="lg">
                  <Link href="/register">
                  ابدأ الآن مجانًا
                    <ArrowRight className="mr-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/how-it-works">
                  كيف يعمل؟
                    <PlayCircle className="mr-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/20">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">لماذا تختار ViewLoop؟</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            نحن نقدم نظامًا عادلاً وآمنًا لمساعدتك على تنمية قناتك أو ببساطة كسب المكافآت من خلال المشاهدة.
            </p>
          </div>
          <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
                <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4'>
                    <Eye className="h-6 w-6 text-primary" />
                </div>
              <h3 className="text-lg font-bold">زيادة المشاهدات</h3>
              <p className="text-sm text-muted-foreground">
              احصل على مشاهدات حقيقية لفيديوهاتك من مستخدمين آخرين في مجتمعنا لزيادة شعبيتك.
              </p>
            </div>
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
                <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4'>
                    <Star className="h-6 w-6 text-primary" />
                </div>
              <h3 className="text-lg font-bold">اكسب النقاط</h3>
              <p className="text-sm text-muted-foreground">
              كل ثانية تشاهدها تتحول إلى نقاط. احصل على مكافآت إضافية عند مشاهدة الإعلانات بالكامل.
              </p>
            </div>
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
                <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4'>
                    <PlayCircle className="h-6 w-6 text-primary" />
                </div>
              <h3 className="text-lg font-bold">اكتشف محتوى جديد</h3>
              <p className="text-sm text-muted-foreground">
              تصفح مجموعة متنوعة من الفيديوهات التي أضافها مستخدمون آخرون واكتشف قنوات جديدة.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
