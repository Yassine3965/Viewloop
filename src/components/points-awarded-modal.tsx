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
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center border-4 animate-scale-in ${isCompletion ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400' : 'bg-blue-400/20 border-blue-400 text-blue-400'
            }`}>
            {isCompletion ? <PartyPopper className="w-8 h-8" /> : <Star className="w-8 h-8" />}
          </div>
          <AlertDialogTitle className="text-2xl font-bold">
            {isCompletion ? 'مبروك!' : 'أحسنت!'}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="px-6 pb-6">
          <p className="text-muted-foreground mb-4">
            {isCompletion
              ? 'لقد أكملت المشاهدة بنجاح.'
              : 'محاولة جيدة! شاهد الفيديو بالكامل لتربح المزيد.'}
          </p>
          <div className="bg-muted rounded-lg p-4 flex items-center justify-center gap-4">
            <p className="text-lg">لقد ربحت</p>
            <div className={`flex items-center gap-2 font-bold text-2xl ${isCompletion ? 'text-yellow-400' : 'text-blue-400'}`}>
              <Star className="w-6 h-6 fill-current" />
              <span>{data.points.toFixed(2)}</span>
            </div>
            <p className="text-lg">نقاط</p>
          </div>
        </div>
        <AlertDialogFooter className="bg-muted/50 p-4">
          <Button onClick={onConfirm} className={`w-full ${isCompletion ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isCompletion ? 'رائع!' : 'متابعة'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
