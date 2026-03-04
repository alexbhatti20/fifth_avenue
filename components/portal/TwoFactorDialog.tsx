import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { setSupabaseSession } from '@/lib/supabase';

interface TwoFactorDialogProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  email: string;
  onSuccess: () => void;
}

// Individual OTP digit input refs
const DIGIT_COUNT = 6;

export function TwoFactorDialog({ open, onClose, employeeId, email, onSuccess }: TwoFactorDialogProps) {
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');

  // Focus first input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRefs.current[0]?.focus(), 80);
    } else {
      setDigits(Array(DIGIT_COUNT).fill(''));
      setShake(false);
    }
  }, [open]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && code.length === 6) {
      handleVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGIT_COUNT);
    if (!pasted) return;
    const next = Array(DIGIT_COUNT).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, DIGIT_COUNT - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsVerifying(true);

      const response = await fetch('/api/portal/security/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, token: code }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid verification code');
      }

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('sb_access_token', data.token);
        if (data.token.length > 10) await setSupabaseSession(data.token);
      }
      if (data.user)     localStorage.setItem('user_data', JSON.stringify(data.user));
      if (data.userType) localStorage.setItem('user_type', data.userType);

      toast.success('2FA verification successful');
      onSuccess();
    } catch (error: any) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      toast.error(error.message || 'Failed to verify code');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setDigits(Array(DIGIT_COUNT).fill(''));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
        {/* Dark card */}
        <div className="relative bg-[#0a0a0a] rounded-2xl overflow-hidden">

          {/* Animated red glow blobs in background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-10 -left-10 w-48 h-48 rounded-full opacity-20 blur-3xl animate-pulse"
              style={{ background: 'radial-gradient(circle, #ef4444, #b91c1c)' }}
            />
            <div
              className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-15 blur-3xl animate-pulse"
              style={{ background: 'radial-gradient(circle, #f97316, #dc2626)', animationDelay: '1s' }}
            />
          </div>

          {/* Top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent animate-[shimmer_2.5s_linear_infinite] [background-size:200%_auto]" />

          <div className="relative z-10 p-8 pt-7">

            {/* Header */}
            <DialogHeader className="mb-6 space-y-0">
              {/* Shield icon with animated red ring */}
              <div className="flex justify-center mb-5">
                <div className="relative">
                  {/* Pulsing rings */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-600 to-rose-700 opacity-20 animate-ping" />
                  <div className="absolute inset-[-4px] rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/20 blur-sm animate-pulse" />
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-red-600 via-rose-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-900/50">
                    <Shield className="h-7 w-7 text-white" strokeWidth={1.5} />
                  </div>
                </div>
              </div>

              {/* Title — gradient, not bold */}
              <DialogTitle asChild>
                <h2
                  className="text-center text-xl font-normal tracking-wide bg-gradient-to-r from-red-400 via-rose-300 to-orange-400 bg-clip-text text-transparent animate-[gradient-x_3s_ease_infinite] [background-size:200%_auto]"
                >
                  Two-Factor Authentication
                </h2>
              </DialogTitle>

              {/* Description */}
              <DialogDescription asChild>
                <p className="text-center text-[13px] font-normal text-zinc-500 mt-2 leading-relaxed">
                  Code from your authenticator app for{' '}
                  <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent font-normal">
                    {email}
                  </span>
                </p>
              </DialogDescription>
            </DialogHeader>

            {/* OTP digit boxes */}
            <div className="space-y-3">
              <p className="text-[11px] font-normal tracking-widest uppercase text-zinc-600 text-center">
                Verification Code
              </p>

              <div
                className={`flex justify-center gap-2 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
                style={{ '--tw-shake': shake ? '1' : '0' } as React.CSSProperties}
              >
                {digits.map((digit, i) => (
                  <div key={i} className="relative">
                    {/* Active glow under filled digit */}
                    {digit && (
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-red-600/30 to-rose-800/20 blur-sm" />
                    )}
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={i === 0 ? handlePaste : undefined}
                      className={[
                        'relative w-11 h-13 text-center text-xl font-mono font-normal rounded-lg outline-none transition-all duration-200',
                        'bg-zinc-900 border text-white caret-red-500',
                        digit
                          ? 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.25)] text-red-300'
                          : 'border-zinc-700 focus:border-red-500/60 focus:shadow-[0_0_10px_rgba(239,68,68,0.2)]',
                      ].join(' ')}
                      style={{ height: '52px' }}
                      autoComplete="one-time-code"
                    />
                  </div>
                ))}
              </div>

              <p className="text-center text-[11px] font-normal text-zinc-600 mt-1">
                Open your authenticator app and enter the current code
              </p>
            </div>

            {/* Bottom gradient divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

            {/* Actions */}
            <DialogFooter className="flex gap-3 sm:gap-3">
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isVerifying}
                className="flex-1 h-11 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 font-normal text-sm transition-all duration-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isVerifying || code.length !== 6}
                className={[
                  'flex-1 h-11 rounded-xl font-normal text-sm text-white border-0 transition-all duration-300',
                  'bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 animate-[gradient-x_3s_ease_infinite] [background-size:200%_auto]',
                  'shadow-lg shadow-red-900/40',
                  'disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed',
                  'hover:shadow-red-700/50 hover:scale-[1.02] active:scale-[0.98]',
                ].join(' ')}
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <KeyRound className="h-4 w-4" strokeWidth={1.5} />
                    Verify
                  </span>
                )}
              </Button>
            </DialogFooter>

          </div>

          {/* Bottom gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
