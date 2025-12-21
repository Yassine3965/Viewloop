
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Link2, Layout, BarChart3, ShieldCheck } from "lucide-react";

export default function AboutPage() {
    return (
        <main className="container mx-auto max-w-4xl py-12 md:py-20">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tight text-primary">حول ViewLoop</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    محرك سحابي ذكي لمزامنة حالات الجلسات وتحليل النشاط الرقمي بدقة متناهية.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-16">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <Link2 className="h-6 w-6 text-primary" />
                            <CardTitle>مزامنة الجلسات (Session Sync)</CardTitle>
                        </div>
                        <CardDescription>
                            توفير اتصال آمن ومستمر بين المتصفح والخادم لمزامنة حالة التفاعل الرقمي في الوقت الفعلي.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            يعمل النظام كعميل حالة (State Client) يقوم بإرسال واستقبال نبضات (Pulses) تقنية للتأكد من اتساق البيانات عبر جميع الأجهزة والتبويبات المفتوحة.
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <Layout className="h-6 w-6 text-primary" />
                            <CardTitle>لوحة تحكم النشاط</CardTitle>
                        </div>
                        <CardDescription>
                            تحويل الجلسات الخام إلى تقارير نشاط مفصلة تساعد المستخدمين في تنظيم وقتهم الرقمي.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            يتم عرض وحدات النشاط (Activity Units) ووحدات التقدم (Progress Units) كمؤشرات تقنية تقيس مستوى التفاعل والاستمرارية داخل المنصة.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-muted/30 p-8 rounded-2xl border border-border">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    الخصوصية والأمان
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                    ViewLoop يتبنى نهج "الخادم المرجعي" (Server-Authoritative)، حيث يتم معالجة كافة القواعد والمنطق في بيئة سحابية آمنة. الإضافة تعمل كجهاز طرفي خامل (Passive Device) لا يتدخل في محتوى الصفحات أو خصوصية المستخدم، بل يكتفي بنقل حالة النشاط العامة عبر منصات المحتوى الرقمي الموثقة لضمان دقة التقارير التقنية.
                </p>
            </div>
        </main>
    );
}
