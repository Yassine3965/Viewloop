import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "./ui/button";
import { ShieldCheck, Activity } from "lucide-react";

interface SessionStatusModalProps {
  open: boolean;
  data: { activityPulse: number; type: string; qualityMessage?: string } | null;
  onConfirm: () => void;
}

export function SessionStatusModal({ open, data, onConfirm }: SessionStatusModalProps) {
  if (!open || !data) return null;

  const isCompletion = data.type === 'completion';

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-xs text-center p-0 overflow-hidden">
        <AlertDialogHeader className="p-6 pb-2 space-y-2">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center border-4 animate-scale-in ${isCompletion ? 'bg-primary/20 border-primary text-primary' : 'bg-muted border-muted-foreground/30 text-muted-foreground'
            }`}>
            {isCompletion ? <ShieldCheck className="w-8 h-8" /> : <Activity className="w-8 h-8" />}
          </div>
          <AlertDialogTitle className="text-xl font-bold">
            {data.qualityMessage || (isCompletion ? 'Session Verified' : 'State Updated')}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="px-6 pb-6">
          <p className="text-sm text-muted-foreground mb-4">
            {isCompletion
              ? 'Activity data has been successfully synchronized.'
              : 'Partial activity state has been registered.'}
          </p>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] text-primary uppercase font-bold tracking-widest">Protocol Sync Status</span>
            <div className={`flex items-center gap-2 font-black text-xl text-primary`}>
              <span>ENCRYPTED & SYNCED</span>
            </div>
          </div>
        </div>
        <AlertDialogFooter className="bg-muted/50 p-4">
          <Button onClick={onConfirm} className="w-full">
            Dismiss
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
