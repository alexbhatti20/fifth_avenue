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

type ResetStep = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState<ResetStep>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form data
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Timer states
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [canResendAt, setCanResendAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);

  // OTP timer countdown
  useEffect(() => {
    if (otpExpiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiresAt - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [otpExpiresAt]);

  // Resend timer countdown
  useEffect(() => {
    if (canResendAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((canResendAt - Date.now()) / 1000));
        setResendCountdown(remaining);
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [canResendAt]);

  // Handle email submission
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check for cooldown
        if (data.cooldownUntil) {
          toast({
            variant: "destructive",
            title: "Rate Limited",
            description: data.error,
          });
          return;
        }
        // Check for resend cooldown
        if (data.remainingSeconds) {
          setCanResendAt(Date.now() + (data.remainingSeconds * 1000));
          toast({
            variant: "destructive",
            title: "Please Wait",
            description: data.error,
          });
          return;
        }
        throw new Error(data.error);
      }

      // Set timers
      setOtpExpiresAt(Date.now() + (data.expiresIn * 1000));
      setCanResendAt(Date.now() + (data.resendIn * 1000));
      
      toast({
        title: "Code Sent!",
        description: "Check your email for the verification code",
      });

      // Dev mode - show OTP in console
      if (data.devOtp) {
        }

      setStep('otp');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send verification code",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP resend
  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setOtpExpiresAt(Date.now() + (data.expiresIn * 1000));
      setCanResendAt(Date.now() + (data.resendIn * 1000));
      setOtp('');
      
      toast({
        title: "Code Resent!",
        description: "A new verification code has been sent",
      });

      if (data.devOtp) {
        }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend code",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter the 6-digit verification code",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.attemptsRemaining !== undefined) {
          toast({
            variant: "destructive",
            title: "Invalid Code",
            description: `${data.error}. ${data.attemptsRemaining} attempts remaining.`,
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setVerificationToken(data.token);
      toast({
        title: "Verified!",
        description: "Now set your new password",
      });
      setStep('password');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Failed to verify code",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match",
      });
      return;
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      toast({
        variant: "destructive",
        title: "Weak Password",
        description: "Password must contain uppercase, lowercase, and a number",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          token: verificationToken,
          newPassword,
          confirmPassword 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: "Password Reset!",
        description: "Your password has been successfully reset",
      });
      setStep('success');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: error.message || "Failed to reset password",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!newPassword) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[a-z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength++;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
    
    return {
      strength,
      label: labels[strength - 1] || '',
      color: colors[strength - 1] || ''
    };
  };

  const passwordStrength = getPasswordStrength();

  // Format countdown
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Step titles
  const getStepTitle = () => {
    switch (step) {
      case 'email': return 'Reset Password';
      case 'otp': return 'Verify Code';
      case 'password': return 'New Password';
      case 'success': return 'Success!';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'email': return "Enter your email to receive a verification code";
      case 'otp': return `Enter the 6-digit code sent to ${email}`;
      case 'password': return "Create a strong new password";
      case 'success': return "Your password has been reset successfully";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-r from-red-600/20 to-orange-500/20 blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: '-20%', right: '-10%' }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-red-800/15 to-red-500/15 blur-3xl"
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          style={{ bottom: '-15%', left: '-10%' }}
        />

        {/* Floating Icons */}
        <motion.div
          className="absolute top-[20%] right-[10%] text-red-500/20"
          animate={{ y: [0, 15, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ShieldCheck className="w-16 h-16" />
        </motion.div>
        <motion.div
          className="absolute bottom-[30%] left-[8%] text-red-600/20"
          animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <KeyRound className="w-12 h-12" />
        </motion.div>
        <motion.div
          className="absolute top-[60%] right-[5%] text-orange-500/15"
          animate={{ y: [0, 10, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <Flame className="w-10 h-10" />
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link href="/" className="block mb-8 text-center">
            <motion.div 
              className="relative w-24 h-24 mx-auto"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-red-500/40 to-red-700/40 rounded-full blur-2xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <Image
                src="/assets/zoiro-logo.png"
                alt="Zoiro Broast"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </motion.div>
          </Link>

          {/* Card */}
          <motion.div
            className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-800/50 p-8 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            {/* Progress Steps */}
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-2">
                {['email', 'otp', 'password', 'success'].map((s, index) => (
                  <div key={s} className="flex items-center">
                    <motion.div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        step === s 
                          ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30' 
                          : index < ['email', 'otp', 'password', 'success'].indexOf(step)
                            ? 'bg-green-500 text-white'
                            : 'bg-zinc-800 text-zinc-500'
                      }`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {index < ['email', 'otp', 'password', 'success'].indexOf(step) ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        index + 1
                      )}
                    </motion.div>
                    {index < 3 && (
                      <div className={`w-8 h-1 mx-1 rounded ${
                        index < ['email', 'otp', 'password', 'success'].indexOf(step)
                          ? 'bg-green-500'
                          : 'bg-zinc-800'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Title */}
            <motion.div
              className="text-center mb-6"
              key={step}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-3xl font-bebas bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-red-500 mb-2">
                {getStepTitle()}
              </h1>
              <p className="text-zinc-400 text-sm">{getStepSubtitle()}</p>
            </motion.div>

            {/* Forms */}
            <AnimatePresence mode="wait">
              {/* Step 1: Email */}
              {step === 'email' && (
                <motion.form
                  key="email-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleSendOTP}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-300 font-medium">Email Address</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12 h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 placeholder:text-zinc-600"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all hover:shadow-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        Send Verification Code
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="text-center pt-4">
                    <Link 
                      href="/auth" 
                      className="text-sm text-zinc-500 hover:text-red-500 transition-colors inline-flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Login
                    </Link>
                  </div>
                </motion.form>
              )}

              {/* Step 2: OTP */}
              {step === 'otp' && (
                <motion.form
                  key="otp-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleVerifyOTP}
                  className="space-y-5"
                >
                  {/* Timer */}
                  <div className="flex justify-center">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                      countdown <= 30 ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      <Timer className="w-4 h-4" />
                      <span className="font-mono text-sm">
                        {countdown > 0 ? `Code expires in ${formatTime(countdown)}` : 'Code expired'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-zinc-300 font-medium">Verification Code</Label>
                    <div className="relative group">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          if (value.length <= 6) setOtp(value);
                        }}
                        maxLength={6}
                        className="pl-12 h-14 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 placeholder:text-zinc-600 text-center text-2xl tracking-[0.5em] font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Resend Button */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={resendCountdown > 0 || isLoading}
                      className={`text-sm inline-flex items-center gap-2 transition-colors ${
                        resendCountdown > 0 
                          ? 'text-zinc-600 cursor-not-allowed' 
                          : 'text-red-500 hover:text-red-400 cursor-pointer'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      {resendCountdown > 0 
                        ? `Resend in ${resendCountdown}s` 
                        : 'Resend Code'}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all hover:shadow-xl"
                    disabled={isLoading || countdown === 0}
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        Verify Code
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('email')}
                      className="text-sm text-zinc-500 hover:text-red-500 transition-colors inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Change Email
                    </button>
                  </div>
                </motion.form>
              )}

              {/* Step 3: New Password */}
              {step === 'password' && (
                <motion.form
                  key="password-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleResetPassword}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-zinc-300 font-medium">New Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-12 pr-12 h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 placeholder:text-zinc-600"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    
                    {/* Password Strength */}
                    {newPassword && (
                      <div className="space-y-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all ${
                                i <= passwordStrength.strength ? passwordStrength.color : 'bg-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs ${
                          passwordStrength.strength >= 4 ? 'text-green-500' : 
                          passwordStrength.strength >= 3 ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {passwordStrength.label}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-zinc-300 font-medium">Confirm Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-12 pr-12 h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 placeholder:text-zinc-600"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Passwords don't match
                      </p>
                    )}
                  </div>

                  {/* Password Requirements */}
                  <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-zinc-400 font-medium">Password must contain:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-green-500' : 'text-zinc-500'}`}>
                        {newPassword.length >= 8 ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-zinc-600" />}
                        8+ characters
                      </div>
                      <div className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-zinc-500'}`}>
                        {/[A-Z]/.test(newPassword) ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-zinc-600" />}
                        Uppercase letter
                      </div>
                      <div className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-green-500' : 'text-zinc-500'}`}>
                        {/[a-z]/.test(newPassword) ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-zinc-600" />}
                        Lowercase letter
                      </div>
                      <div className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-green-500' : 'text-zinc-500'}`}>
                        {/[0-9]/.test(newPassword) ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-zinc-600" />}
                        Number
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all hover:shadow-xl"
                    disabled={isLoading || newPassword !== confirmPassword || newPassword.length < 8}
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        Reset Password
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.form>
              )}

              {/* Step 4: Success */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <motion.div 
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/30"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <CheckCircle2 className="h-12 w-12 text-white" />
                    </motion.div>
                  </motion.div>
                  
                  <motion.h2 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-white mb-3"
                  >
                    Password Reset Complete! 🎉
                  </motion.h2>
                  
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-zinc-400 mb-6"
                  >
                    You can now login with your new password
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Button
                      onClick={() => router.push('/auth')}
                      className="w-full h-12 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-600/30 transition-all hover:shadow-xl"
                    >
                      Go to Login
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center mt-6"
          >
            <Link 
              href="/" 
              className="text-sm text-zinc-600 hover:text-red-500 transition-colors inline-flex items-center gap-1"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
