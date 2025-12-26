'use client';

import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/lib/app-provider';
import { useRouter } from 'next/navigation';
import { Mail, User, Shield, Key, Camera, Loader2, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { Badge } from '@/components/ui/badge';

export default function AccountPage() {
    const { user, isUserLoading, logout, updateProfile } = useApp();
    const router = useRouter();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: ''
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            router.push(`/login`);
            return;
        }
        setFormData({
            name: user.name || '',
            email: user.email || ''
        });
    }, [user, isUserLoading, router]);

    const handleAvatarUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('يرجى اختيار ملف صورة صحيح.');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('حجم الملف يجب أن يكون أقل من 5 ميجابايت.');
            return;
        }

        setIsUploadingAvatar(true);
        const result = await updateProfile(file);
        setIsUploadingAvatar(false);

        if (!result.success) {
            alert('فشل في تحديث الصورة الشخصية.');
        }
    };

    const handleUpdateProfile = async () => {
        setIsUpdating(true);
        // Here you would call an API to update the profile
        // For now, we'll just simulate it
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsUpdating(false);
        alert('تم تحديث الملف الشخصي بنجاح.');
    };

    const isLoading = isUserLoading || !user;

    if (isLoading) {
        return (
            <main className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </main>
        );
    }

    if (!user) {
        return (
            <main className="flex h-[80vh] items-center justify-center">
                <div className='text-center'>
                    <p className='text-destructive'>لم يتم العثور على ملف المستخدم.</p>
                    <Button onClick={logout} variant="link">تسجيل الخروج</Button>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 bg-background relative overflow-hidden pb-12">
            {/* Background Decorative Blobs */}
            <div className="absolute top-0 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-40 -left-20 w-80 h-80 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto max-w-4xl space-y-8 p-4 md:p-8 animate-scale-in relative z-10">

                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight">حسابي</h1>
                    <p className="text-muted-foreground">إدارة إعدادات حسابك الشخصي</p>
                </div>

                {/* Profile Card */}
                <Card className="glass-card border-white/5 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <User className="h-6 w-6" />
                            الملف الشخصي
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                <Avatar className="h-24 w-24 border-4 border-background ring-2 ring-white/10 relative">
                                    <AvatarImage src={user.avatar} alt={user.name} />
                                    <AvatarFallback className="text-2xl bg-transparent">
                                        <img src="/logo.png" alt="Logo" className="h-full w-full rounded-full" />
                                    </AvatarFallback>
                                </Avatar>
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg"
                                    onClick={handleAvatarUpload}
                                    disabled={isUploadingAvatar}
                                >
                                    {isUploadingAvatar ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Camera className="h-4 w-4" />
                                    )}
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                            <div className="flex-1 space-y-4 w-full sm:w-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">الاسم</Label>
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="أدخل اسمك"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">البريد الإلكتروني</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="أدخل بريدك الإلكتروني"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={user.emailVerified ? 'default' : 'destructive'} className="rounded-full px-3 py-1 text-xs">
                                        {user.emailVerified ? 'محقق' : 'غير محقق'}
                                    </Badge>
                                    {!user.emailVerified && (
                                        <Button variant="link" size="sm" className="text-xs">
                                            إرسال رابط التحقق مرة أخرى
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex justify-end">
                            <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                                {isUpdating ? (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                ) : (
                                    <Save className="h-4 w-4 ml-2" />
                                )}
                                حفظ التغييرات
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Security Card */}
                <Card className="glass-card border-white/5 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Shield className="h-6 w-6" />
                            الأمان
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="current-password">كلمة المرور الحالية</Label>
                            <Input
                                id="current-password"
                                type="password"
                                placeholder="أدخل كلمة المرور الحالية"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    placeholder="أدخل كلمة المرور الجديدة"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">تأكيد كلمة المرور الجديدة</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    placeholder="أكد كلمة المرور الجديدة"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button variant="outline">
                                <Key className="h-4 w-4 ml-2" />
                                تغيير كلمة المرور
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="glass-card border-destructive/20 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-destructive">
                            <Trash2 className="h-6 w-6" />
                            منطقة الخطر
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            هذه الإجراءات لا يمكن التراجع عنها. يرجى الحذر قبل المتابعة.
                        </p>
                        <DeleteAccountDialog
                            open={isDeleteDialogOpen}
                            onOpenChange={setIsDeleteDialogOpen}
                        >
                            <Button variant="destructive">
                                <Trash2 className="h-4 w-4 ml-2" />
                                حذف الحساب
                            </Button>
                        </DeleteAccountDialog>
                    </CardContent>
                </Card>

            </div>
        </main>
    );
}
