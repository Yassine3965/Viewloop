
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TrendingUp, ChevronsUp, Gem, Star, ShieldCheck, Tv, MousePointerClick } from "lucide-react";

export default function HowToEarnMorePage() {
  return (
    <main className="container mx-auto max-w-4xl py-12 md:py-20">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-primary">كيف تربح أكثر؟</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            استفد من كل الميزات المتاحة في ViewLoop لمضاعفة أرباحك من النقاط والمجوهرات.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Card 1: Level Up */}
        <Card className="hover:shadow-lg transition-shadow border-2 border-primary shadow-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <ChevronsUp className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>1. ارفع مستواك</CardTitle>
            <CardDescription>
                المستويات الأعلى تمنحك نقاطًا أكثر لكل ثانية.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
                كلما ارتفع مستواك، زاد "مُضاعِف النقاط" الذي تحصل عليه مقابل مشاهدة الفيديوهات. استثمر مجوهراتك لرفع مستواك والوصول إلى معدلات ربح أعلى.
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Watch Ads */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Star className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>2. شاهد الإعلانات كاملة</CardTitle>
            <CardDescription>
                الوقت الإضافي بعد الفيديو يساوي نقاط إضافية.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
                عندما تشاهد إعلانًا بالكامل، يتم احتساب هذا الوقت "كوقت إضافي" ويمنحك نقاطًا بمعدل أعلى (0.5 نقطة/ثانية). لا تتخطى الإعلانات لتربح أكثر.
            </p>
          </CardContent>
        </Card>
        
        {/* Card 3: Earn Gems */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Gem className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>3. اجمع المجوهرات</CardTitle>
            <CardDescription>
                المجوهرات هي مفتاحك للترقية وتحسين السمعة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
                يمكنك كسب مجوهرة إضافية مقابل كل إعلان تشاهده. استخدم هذه المجوهرات لرفع مستواك أو لتحسين سمعتك إذا انخفضت.
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Good Reputation */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>4. حافظ على سمعة جيدة</CardTitle>
            <CardDescription>
                السلوك الجيد يُكافأ، والسلوك المشبوه يُعاقب.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
                تجنب ترك التبويبة غير نشطة أو عدم تحريك الماوس لفترات طويلة. النظام يراقب هذه السلوكيات، والحفاظ على سمعة جيدة يضمن حصولك على كامل نقاطك.
            </p>
          </CardContent>
        </Card>
        
        {/* Card 5: Be Active */}
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <MousePointerClick className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>5. كن نشطًا</CardTitle>
                <CardDescription>
                    تأكد من أنك تتفاعل مع الصفحة.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                    النظام يتأكد من أنك تشاهد الفيديو بالفعل عن طريق تتبع حركة الماوس ونشاط التبويبة. التفاعل المستمر يضمن عدم تطبيق أي عقوبات على أرباحك.
                </p>
            </CardContent>
        </Card>

        {/* Card 6: Add your videos */}
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Tv className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>6. أضف فيديوهاتك</CardTitle>
                <CardDescription>
                    استخدم نقاطك لزيادة مشاهداتك.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                    الهدف النهائي هو استخدام النقاط التي كسبتها لإنشاء حملات لفيديوهاتك الخاصة، مما يزيد من مشاهداتك وتفاعلك على يوتيوب.
                </p>
            </CardContent>
        </Card>
        
      </div>
    </main>
  );
}
