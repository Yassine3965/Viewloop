
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlayCircle, Star, Eye } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <main className="container mx-auto max-w-4xl py-12 md:py-20">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">كيف يعمل ViewLoop</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
        نظام بسيط ومباشر لتحقيق الفائدة المتبادلة.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Step 1 */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Eye className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>1. شاهد الفيديوهات</CardTitle>
            <CardDescription>
            اختر أي فيديو من قائمتنا المتزايدة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
            تصفح مكتبة الفيديوهات التي أضافها المستخدمون الآخرون. كلما شاهدت أكثر، زادت فرصتك في كسب النقاط.
            </p>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Star className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>2. اكسب النقاط</CardTitle>
            <CardDescription>
            كل ثانية مشاهدة تمنحك نقاطًا.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
            نظامنا يمنحك نقاطًا مقابل وقت المشاهدة. هذه النقاط هي عملة المنصة التي يمكنك استخدامها للترويج لفيديوهاتك.
            </p>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <PlayCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>3. أضف فيديوهاتك</CardTitle>
            <CardDescription>
            استخدم نقاطك لإنشاء حملاتك الخاصة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
            عندما تجمع نقاطًا كافية، يمكنك إضافة فيديوهاتك الخاصة إلى المنصة ليراها الآخرون ويكسبوا نقاطًا من مشاهدتها.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
