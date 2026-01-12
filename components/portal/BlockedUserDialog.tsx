'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, LogOut, ShieldX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface BlockedUserDialogProps {
  open: boolean;
  reason: string;
  onLogout: () => void;
  autoLogoutSeconds?: number;
  employeeName?: string;
}

export function BlockedUserDialog({
  open,
  reason,
  onLogout,
  autoLogoutSeconds = 5,
  employeeName = 'Employee',
}: BlockedUserDialogProps) {
  const [countdown, setCountdown] = useState(autoLogoutSeconds);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!open) {
      setCountdown(autoLogoutSeconds);
      setProgress(100);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
      setProgress((prev) => {
        const decrement = 100 / autoLogoutSeconds;
        return Math.max(0, prev - decrement);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, autoLogoutSeconds, onLogout]);

  const handleLogoutNow = useCallback(() => {
    onLogout();
  }, [onLogout]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md border-red-500/50 bg-red-50 dark:bg-red-950/30" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center animate-pulse">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          <DialogTitle className="text-xl text-red-700 dark:text-red-400 flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Account Access Blocked
          </DialogTitle>
          <DialogDescription className="text-red-600/80 dark:text-red-400/80">
            Hello <span className="font-semibold">{employeeName}</span>, your portal access has been disabled by an administrator.
          </DialogDescription>
        </DialogHeader>

        {/* Reason Box */}
        <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 rounded-lg p-4 my-4">
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Reason for Block
          </h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {reason || 'Your account has been blocked. Please contact the administrator for more information.'}
          </p>
        </div>

        {/* Countdown Warning */}
        <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <Clock className="h-4 w-4 animate-pulse" />
              Auto logout in
            </span>
            <span className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
              {countdown}s
            </span>
          </div>
          <Progress value={progress} className="h-2 bg-red-200 dark:bg-red-900" />
        </div>

        {/* Action */}
        <div className="flex flex-col gap-2 mt-2">
          <Button
            variant="destructive"
            onClick={handleLogoutNow}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout Now
          </Button>
          <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
            Contact HR or your manager for assistance
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
