'use client';

import { useState, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useApp } from '@/lib/app-provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const deleteSchema = z.object({
  reason: z.string().min(1, { message: 'الرجاء ذكر سبب الحذف.' }),
  confirmation: z
    .string()
    .refine((val) => val === 'delete', {
      message: 'الرجاء كتابة "delete" للتأكيد.',
    }),
});

interface DeleteAccountDialogProps {
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}

export function DeleteAccountDialog({ children, open, onOpenChange }: DeleteAccountDialogProps) {
  const { deleteCurrentUserAccount } = useApp();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<z.infer<typeof deleteSchema>>({
    resolver: zodResolver(deleteSchema),
    defaultValues: {
      reason: '',
      confirmation: '',
    },
    mode: 'onChange',
  });

  const { reset, formState: { isValid } } = form;
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        reset();
        setIsDeleting(false);
    }
    onOpenChange(isOpen);
  }

  const onSubmit = async (data: z.infer<typeof deleteSchema>) => {
    setIsDeleting(true);
    const result = await deleteCurrentUserAccount(data.reason);

    if (result.success) {
      toast({
        title: 'تم حذف الحساب',
        description: 'تم حذف حسابك بنجاح. نأسف لرؤيتك تذهب.',
      });
      handleOpenChange(false);
      // The auth listener in AppProvider will handle redirecting the user.
    } else {
      toast({
        variant: 'destructive',
        title: 'فشل حذف الحساب',
        description: result.message || 'حدث خطأ غير متوقع.',
      });
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>حذف الحساب نهائيًا</DialogTitle>
          <DialogDescription>
            هذا الإجراء لا يمكن التراجع عنه. سيتم حذف حسابك وجميع بياناتك
            المرتبطة به بشكل دائم.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>السبب</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="لماذا قررت حذف حسابك؟"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    للتأكيد، الرجاء كتابة{' '}
                    <span className="font-bold text-destructive">delete</span>{' '}
                    أدناه:
                  </FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                disabled={!isValid || isDeleting}
              >
                {isDeleting && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                تأكيد الحذف النهائي
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
