'use client';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Timer,
  RefreshCw,
  Home,
  Flame,
  Star,
  ChefHat,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ResetStep = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState<ResetStep>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [canResendAt, setCanResendAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (otpExpiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiresAt - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining === 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [otpExpiresAt]);

  useEffect(() => {
    if (canResendAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((canResendAt - Date.now()) / 1000));
        setResendCountdown(remaining);
        if (remaining === 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [canResendAt]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOtpExpiresAt(Date.now() + (data.expiresIn * 1000));
      setCanResendAt(Date.now() + (data.resendIn * 1000));
      toast({ title: "VIBE CHECK SENT!", description: "Check your email for the code." });
      setStep('otp');
    } catch (error: any) {
      toast({ variant: "destructive", title: "WHACK!", description: error.message });
    } finally { setIsLoading(false); }
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setOtpExpiresAt(Date.now() + (data.expiresIn * 1000));
      setCanResendAt(Date.now() + (data.resendIn * 1000));
      setOtp('');
      toast({ title: "CODE RESENT!", description: "A new vibe check is in your inbox." });
    } catch { toast({ variant: "destructive", title: "ERROR", description: "Failed to resend." }); }
    finally { setIsLoading(false); }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVerificationToken(data.token);
      setStep('password');
    } catch (error: any) {
      toast({ variant: "destructive", title: "INVALID CODE", description: error.message });
    } finally { setIsLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: verificationToken, newPassword, confirmPassword }),
      });
      if (!response.ok) throw new Error("Failed");
      setStep('success');
    } catch { toast({ variant: "destructive", title: "RESET FAILED", description: "Try again later." }); }
    finally { setIsLoading(false); }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#FFD200] relative overflow-hidden flex items-center justify-center p-6">
      {/* Urban Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#008A45] skew-x-12 translate-x-20" />
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        
        {/* Floating Accents */}
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute top-20 left-10 text-black/20"
        >
          <Flame className="w-32 h-32" />
        </motion.div>
        <motion.div
          animate={{ x: [0, 20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 7, repeat: Infinity }}
          className="absolute bottom-20 right-10 text-white/20"
        >
          <Sparkles className="w-40 h-40" />
        </motion.div>
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* Logo Section */}
        <Link href="/" className="flex flex-col items-center mb-12 group">
          <div className="relative">
            <span className="font-bebas text-5xl md:text-6xl tracking-tight leading-none text-black">
              FIFTH AVENUE
            </span>
            <div className="absolute -bottom-2 left-0 w-full h-[4px] bg-black" />
            <div className="absolute -bottom-6 right-0 bg-black px-2 py-0.5 border border-[#FFD200] transform rotate-[-2deg]">
              <span className="font-bebas text-xs text-[#FFD200]">PIZZA CO.</span>
            </div>
          </div>
          <span className="font-caveat text-3xl text-[#ED1C24] mt-8">Chasing Flavours</span>
        </Link>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-[8px] border-black p-8 md:p-12 shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]"
        >
          {/* Progress Indicator */}
          <div className="flex justify-between mb-12 border-b-4 border-black pb-8">
            {['email', 'otp', 'password', 'success'].map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <div className={cn(
                  "w-10 h-10 border-4 border-black flex items-center justify-center font-bebas text-xl transition-all",
                  step === s ? "bg-[#FFD200] scale-125 shadow-[4px_4px_0px_0px_rgba(237,28,36,1)]" : 
                  ['email', 'otp', 'password', 'success'].indexOf(step) > i ? "bg-[#008A45] text-white" : "bg-gray-100"
                )}>
                  {['email', 'otp', 'password', 'success'].indexOf(step) > i ? "✓" : i + 1}
                </div>
                <span className="font-bebas text-xs tracking-widest hidden sm:block">{s.toUpperCase()}</span>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSendOTP}
                className="space-y-8"
              >
                <div>
                  <h2 className="font-bebas text-5xl text-black mb-2">REGAIN ACCESS</h2>
                  <p className="font-source-sans font-bold text-black/60 uppercase text-xs tracking-widest">Enter your email to verify your squad status.</p>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-black" />
                    <Input
                      type="email"
                      placeholder="YOUR@EMAIL.COM"
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toUpperCase())}
                      className="pl-14 h-16 rounded-none border-4 border-black font-bebas text-2xl tracking-widest focus-visible:ring-0 focus-visible:bg-gray-50"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-16 rounded-none bg-black text-white font-bebas text-3xl tracking-widest hover:bg-[#ED1C24] transition-all shadow-[6px_6px_0px_0px_rgba(255,210,0,1)] hover:shadow-none"
                  >
                    {isLoading ? "SENDING..." : "SEND CODE"}
                  </Button>
                </div>
                
                <div className="text-center">
                  <Link href="/auth?tab=login" className="font-bebas text-xl text-black hover:text-[#ED1C24] flex items-center justify-center gap-2">
                    <ArrowLeft className="w-5 h-5" /> BACK TO THE SQUAD
                  </Link>
                </div>
              </motion.form>
            )}

            {step === 'otp' && (
              <motion.form
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOTP}
                className="space-y-8"
              >
                <div>
                   <div className="flex items-center gap-2 mb-4">
                      <Timer className={cn("w-6 h-6", countdown <= 30 ? "text-[#ED1C24]" : "text-black")} />
                      <span className="font-bebas text-2xl">EXPIRES: {formatTime(countdown)}</span>
                   </div>
                   <h2 className="font-bebas text-5xl text-black mb-2">VERIFY VIBE</h2>
                   <p className="font-source-sans font-bold text-black/60 uppercase text-xs">Enter the 6-digit code sent to your inbox.</p>
                </div>

                <Input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="h-20 text-center rounded-none border-4 border-black font-bebas text-5xl tracking-[0.5em] focus-visible:ring-0"
                  placeholder="000000"
                  required
                />

                <Button
                  type="submit"
                  disabled={isLoading || countdown === 0}
                  className="w-full h-16 rounded-none bg-black text-white font-bebas text-3xl tracking-widest hover:bg-[#008A45]"
                >
                  {isLoading ? "VERIFYING..." : "VERIFY CODE"}
                </Button>

                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendCountdown > 0}
                  className="w-full font-bebas text-xl text-black hover:underline disabled:opacity-50"
                >
                  {resendCountdown > 0 ? `RESEND IN ${resendCountdown}S` : "RESEND VIBE CHECK"}
                </button>
              </motion.form>
            )}

            {step === 'password' && (
              <motion.form
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleResetPassword}
                className="space-y-8"
              >
                <h2 className="font-bebas text-5xl text-black">NEW IDENTITY</h2>
                
                <div className="space-y-4">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-black" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="NEW PASSWORD"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-14 h-16 rounded-none border-4 border-black font-bebas text-2xl tracking-widest"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2">
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-black" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="CONFIRM PASSWORD"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-14 h-16 rounded-none border-4 border-black font-bebas text-2xl tracking-widest"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2">
                      {showConfirmPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || newPassword !== confirmPassword}
                  className="w-full h-16 rounded-none bg-black text-white font-bebas text-3xl tracking-widest hover:bg-[#ED1C24]"
                >
                  {isLoading ? "RESETTING..." : "CONFIRM NEW PASSWORD"}
                </Button>
              </motion.form>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8"
              >
                <div className="w-24 h-24 bg-[#008A45] border-8 border-black flex items-center justify-center mx-auto transform rotate-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                   <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={3} />
                </div>
                <h2 className="font-bebas text-6xl text-black leading-none">ACCESS<br/>RESTORED</h2>
                <p className="font-source-sans font-bold text-black/60 uppercase">Your credentials are updated. The streets are waiting.</p>
                <Link href="/auth?tab=login">
                  <Button className="w-full h-16 rounded-none bg-black text-white font-bebas text-3xl tracking-widest">
                    BACK TO LOGIN
                  </Button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
