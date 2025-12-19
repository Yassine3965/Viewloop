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
  points: number;
  onConfirm: () => void;
}

export function PointsAwardedModal({ open, points, onConfirm }: PointsAwardedModalProps) {
  if (!open) return null;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-xs text-center p-0 overflow-hidden">
        <AlertDialogHeader className="p-6 pb-2 space-y-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-400/20 flex items-center justify-center border-4 border-yellow-400 text-yellow-400 animate-scale-in">
                <PartyPopper className="w-8 h-8" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold">
            مبروك!
            </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="px-6 pb-6">
            <p className="text-muted-foreground mb-4">
                لقد أكملت المشاهدة بنجاح.
            </p>
            <div className="bg-muted rounded-lg p-4 flex items-center justify-center gap-4">
                <p className="text-lg">لقد ربحت</p>
                <div className="flex items-center gap-2 font-bold text-2xl text-yellow-400">
                    <Star className="w-6 h-6 fill-current"/>
                    <span>{points}</span>
                </div>
                 <p className="text-lg">نقاط</p>
            </div>
        </div>
        <AlertDialogFooter className="bg-muted/50 p-4">
            <Button onClick={onConfirm} className="w-full bg-success hover:bg-success/90">
                رائع!
            </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
