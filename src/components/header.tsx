
'use client';

import Link from 'next/link';
import { Moon, Sun, LogIn, LogOut, LayoutDashboard, Star, Trash2, Search, PlayCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/logo';
import { useApp } from '@/lib/app-provider';
import { usePathname, useRouter } from 'next/navigation';
import { Skeleton } from './ui/skeleton';
import { DeleteAccountDialog } from './delete-account-dialog';
import { Input } from './ui/input';

function UserSection() {
  const { user, isUserLoading, logout } = useApp();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (isUserLoading) {
    return (
        <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
    );
  }

  if (!user) {
    return (
        <Button asChild variant="outline">
            <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                <span>تسجيل الدخول</span>
            </Link>
        </Button>
    );
  }
  
  return (
    <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            <span className="font-semibold">{user.points ?? 0}</span>
        </div>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer">
                    <span className="font-semibold text-sm">{user.name}</span>
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.avatar ?? ''} alt={user?.name ?? ''} />
                        <AvatarFallback>{(user?.name ?? '').charAt(0)}</AvatarFallback>
                    </Avatar>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                    <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>لوحة التحكم</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DeleteAccountDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <DialogTrigger asChild>
                        <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>حذف الحساب</span>
                        </DropdownMenuItem>
                    </DialogTrigger>
                </DeleteAccountDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    </div>
  );
}


export function Header() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, searchQuery, setSearchQuery } = useApp();
  const pathname = usePathname();

  const isWatchPage = pathname === '/watch';

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/watch" className="hover:text-primary transition-colors font-medium">شاهد واكسب</Link>
            <Link href="/campaign" className="hover:text-primary transition-colors font-medium">أضف فيديو</Link>
            <Link href="/how-it-works" className="hover:text-primary transition-colors font-medium">كيف يعمل</Link>
          </nav>
        </div>

        {isWatchPage && (
          <div className="flex-1 flex justify-center px-4 lg:px-8">
            <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="ابحث عن فيديو..."
                    className="w-full pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>
        )}

        <div className="flex flex-1 items-center justify-end space-x-4" dir="ltr">
             {mounted ? (
            <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="تبديل السمة"
            >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">تبديل السمة</span>
            </Button>
            ) : <Skeleton className="h-8 w-8" />}
            <div className='h-6 w-px bg-border'/>
            <nav>
                <UserSection />
            </nav>
        </div>
      </div>
    </header>
  );
}
