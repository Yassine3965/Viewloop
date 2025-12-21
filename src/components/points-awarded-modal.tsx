'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "./ui/button";
import { PartyPopper, Star } from "lucide-react";

interface PointsAwardedModalProps {
  open: boolean;
  data: { points: number; type: string } | null;
  onConfirm: () => void;
}

export function PointsAwardedModal({ open, data, onConfirm }: PointsAwardedModalProps) {
  if (!open || !data) return null;

  const isCompletion = data.type === 'completion';

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-xs text-center p-0 overflow-hidden">
        <AlertDialogHeader className="p-6 pb-2 space-y-2">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center border-4 animate-scale-in ${isCompletion ? 'bg-primary/20 border-primary text-primary' : 'bg-muted border-muted-foreground/30 text-muted-foreground'
            }`}>
            {isCompletion ? <PartyPopper className="w-8 h-8" /> : <Star className="w-8 h-8" />}
          </div>
          <AlertDialogTitle className="text-xl font-bold">
            {isCompletion ? 'تم توثيق الجلسة' : 'تم تحديث الحالة'}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="px-6 pb-6">
          <p className="text-sm text-muted-foreground mb-4">
            {isCompletion
              ? 'تمت مزامنة بيانات النشاط بنجاح مع الخادم.'
              : 'تم تسجيل سجل نشاط جزئي في النظام السحابي.'}
          </p>
          <div className="bg-muted rounded-lg p-3 flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Activity Units Recorded</span>
            <div className={`flex items-center gap-2 font-black text-2xl ${isCompletion ? 'text-primary' : 'text-muted-foreground'}`}>
              <span>{data.points.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <AlertDialogFooter className="bg-muted/50 p-4">
          <Button onClick={onConfirm} className="w-full">
            إغلاق التقرير
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
