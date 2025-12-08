
import { Button } from '@/components/ui/button';
import { ArrowRight, PlayCircle, Eye, Star, TrendingUp, ArrowDown } from 'lucide-react';
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
              ضاعف أرباح إعلانات يوتيوب
              </h1>
              <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              منصة ViewLoop تحفز مشاهديك على مشاهدة الإعلانات بالكامل، مما يزيد من أرباح قناتك بشكل مباشر. انضم إلينا وحوّل كل مشاهدة إلى دخل إضافي.
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
              <div className="flex justify-center pt-12 animate-bounce">
                <ArrowDown className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/20">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Viewloop مصمم لزيادة أرباح منشئي المحتوى</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            نحن نقدم نظامًا مبتكرًا يربط بين منشئي المحتوى والمشاهدين. زيادة أرباحك من الإعلانات لم تكن أسهل من أي وقت مضى.
            </p>
          </div>
          <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
                <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4'>
                    <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              <h3 className="text-lg font-bold">زيادة أرباح الإعلانات</h3>
              <p className="text-sm text-muted-foreground">
              نظامنا يشجع على مشاهدة الإعلانات بالكامل، مما يرفع من قيمة الظهور ويزيد من دخلك من يوتيوب.
              </p>
            </div>
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
                <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4'>
                    <Star className="h-6 w-6 text-primary" />
                </div>
              <h3 className="text-lg font-bold">مكافآت للمشاهدين</h3>
              <p className="text-sm text-muted-foreground">
              يكسب المشاهدون نقاطًا مقابل كل ثانية مشاهدة، مع مكافأة خاصة عند إكمال الإعلانات، مما يخلق تفاعلًا مربحًا للطرفين.
              </p>
            </div>
            <div className="grid gap-1 text-center p-6 rounded-lg bg-card shadow-sm hover:shadow-lg transition-shadow">
                <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4'>
                    <Eye className="h-6 w-6 text-primary" />
                </div>
              <h3 className="text-lg font-bold">زيادة مشاهدات الفيديو</h3>
              <p className="text-sm text-muted-foreground">
              استخدم النقاط التي تجمعها لإنشاء حملات لفيديوهاتك الخاصة، واحصل على مشاهدات حقيقية من مجتمعنا.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
