'use client';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  MapPin,
  Home,
  Flame,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { TwoFactorDialog } from "@/components/portal/TwoFactorDialog";
import { GoogleSignInButton } from "@/components/ui/google-sign-in-button";
import { cn } from "@/lib/utils";

type AuthFlow = 
  | 'initial'           // Enter email to check user type
  | 'customer-login'    // Existing customer login
  | 'customer-register' // New customer registration
  | 'employee-login'    // Active employee/admin login
  | 'employee-activate' // Inactive employee activation
  | 'otp-verify'        // OTP verification
  | 'success';          // Success screen

interface UserCheckResult {
  exists: boolean;
  userType: 'admin' | 'employee' | 'customer' | null;
  isEmployee: boolean;
  isActive: boolean;
  needsActivation: boolean;
  isBlocked?: boolean;
  blockReason?: string;
  name?: string;
  email?: string;
}

export default function UnifiedAuth() {
  const router = useRouter();
  const { toast } = useToast();
  const { sendLoginOTP, verifyLoginOTP, sendRegisterOTP, verifyRegisterOTP, user } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  
  const [flow, setFlow] = useState<AuthFlow>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [userCheck, setUserCheck] = useState<UserCheckResult | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [twoFAData, setTwoFAData] = useState<{ employeeId: string; email: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
    licenseId: "",
  });

  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Confetti celebration function
  const triggerConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Confetti from both sides
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#FFD200', '#008A45', '#ED1C24', '#000000'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#FFD200', '#008A45', '#ED1C24', '#000000'],
      });
    }, 250);
  }, []);

  // Handle URL parameters for Google OAuth errors/success
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get('error');
    const googleLogin = searchParams.get('google_login');
    const googleRegister = searchParams.get('google_register');
    const reason = searchParams.get('reason');

    const tab = searchParams.get('tab');
    if (tab === 'register') {
      setFlow('customer-register');
    } else if (tab === 'login') {
      setFlow('initial');
    }

    // Session expired redirect from middleware
    if (reason === 'expired') {
      setAuthError('Your session has expired. Please sign in again.');
      toast({
        title: 'Session Expired',
        description: 'Your session has expired. Please sign in again.',
        variant: 'destructive',
      });
      // Remove the reason param from URL without triggering a navigation
      const clean = new URLSearchParams(window.location.search);
      clean.delete('reason');
      const qs = clean.toString();
      window.history.replaceState({}, '', qs ? `/auth?${qs}` : '/auth');
    } else if (error) {
      const decodedError = decodeURIComponent(error);
      setAuthError(decodedError);
      toast({
        title: "Authentication Error",
        description: decodedError,
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, '', '/auth');
    } else if (googleLogin === 'success') {
      toast({
        title: "Welcome back!",
        description: "You've been signed in with Google.",
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (googleRegister === 'success') {
      toast({
        title: "Account Created!",
        description: "Welcome to ZOIRO Broast!",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  // Redirect if already logged in (only on initial mount, not after login)
  useEffect(() => {
    if (!hasCheckedAuth) {
      setHasCheckedAuth(true);
      if (user) {
        const userType = localStorage.getItem('user_type');
        if (userType === 'admin' || userType === 'employee') {
          router.push("/portal");
        } else {
          router.push("/");
        }
      }
    }
  }, [user, router, hasCheckedAuth]);

  // Step 1: Check user by email
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      const result = await response.json() as UserCheckResult & { error?: string };

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check user. Please try again.');
      }

      setUserCheck(result);

      if (result.exists) {
        // Check if employee is blocked
        if (result.isEmployee && result.isBlocked) {
          toast({
            title: "Account Blocked",
            description: result.blockReason || "Your portal access has been disabled. Please contact the administrator.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        
        if (result.isEmployee) {
          if (result.isActive) {
            setFlow('employee-login');
            if (result.name) {
              setFormData(prev => ({ ...prev, name: result.name || '' }));
            }
          } else {
            setFlow('employee-activate');
            if (result.name) {
              setFormData(prev => ({ ...prev, name: result.name || '' }));
            }
            toast({
              title: "Account Activation Required",
              description: "Please enter your employee license ID to activate your account.",
            });
          }
        } else {
          setFlow('customer-login');
          if (result.name) {
            setFormData(prev => ({ ...prev, name: result.name || '' }));
          }
        }
      } else {
        setFlow('customer-register');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to check user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle customer/employee login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password.length < 8) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const result = await sendLoginOTP(formData.email, formData.password);

    // Check if 2FA is required
    if (result.requires2FA && result.employeeId) {
      setTwoFAData({
        employeeId: result.employeeId,
        email: formData.email,
      });
      setShow2FADialog(true);
      setIsLoading(false);
      return;
    }

    if (result.error) {
      toast({
        title: "Login Failed",
        description: result.error,
        variant: "destructive",
      });
      setIsLoading(false);
    } else if (result.directLogin) {
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      const userType = result.userType;
      setTimeout(() => {
        if (userType === 'admin' || userType === 'employee') {
          router.push("/portal");
        } else {
          router.push("/");
        }
        router.refresh();
      }, 100);
    } else if (result.requiresOTP) {
      toast({
        title: "OTP Sent!",
        description: "Check your email for the verification code.",
      });
      setFlow('otp-verify');
      setIsLoading(false);
    }
  };

  const handle2FASuccess = () => {
    setShow2FADialog(false);
    toast({
      title: "Welcome back!",
      description: "2FA verification successful. Redirecting...",
    });
    setTimeout(() => {
      router.push("/portal");
      router.refresh();
    }, 500);
  };

  // Handle customer registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your full name",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone.trim()) {
      toast({
        title: "Phone Required",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    // Additional password strength checks matching backend
    const hasUppercase = /[A-Z]/.test(formData.password);
    const hasLowercase = /[a-z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      toast({
        title: "Weak Password",
        description: "Password must contain uppercase, lowercase, and a number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const result = await sendRegisterOTP(
      formData.email,
      formData.name,
      formData.phone,
      formData.password,
      formData.address
    );

    if (result.error) {
      toast({
        title: "Registration Failed",
        description: result.error,
        variant: "destructive",
      });
      setIsLoading(false);
    } else {
      toast({
        title: "OTP Sent!",
        description: "Check your email for the verification code.",
      });
      setFlow('otp-verify');
      setIsLoading(false);
    }
  };

  // Handle employee activation - Step 1: Validate license
  const handleValidateLicense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.licenseId) {
      toast({
        title: "License ID Required",
        description: "Please enter your employee license ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/activate-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          licenseId: formData.licenseId,
          step: 'validate-license',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Validation Failed",
          description: result.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "License Verified!",
        description: "Enter the OTP sent to your email and create your password.",
      });
      setFlow('otp-verify');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate license. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Employee activation flow
    if (userCheck?.isEmployee && userCheck?.needsActivation) {
      if (formData.password.length < 8) {
        toast({
          title: "Weak Password",
          description: "Password must be at least 8 characters",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Additional password strength checks
      const hasUppercase = /[A-Z]/.test(formData.password);
      const hasLowercase = /[a-z]/.test(formData.password);
      const hasNumber = /[0-9]/.test(formData.password);
      
      if (!hasUppercase || !hasLowercase || !hasNumber) {
        toast({
          title: "Weak Password",
          description: "Password must contain uppercase, lowercase, and a number",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/activate-employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            otp: otp,
            step: 'verify-and-activate',
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          toast({
            title: "Activation Failed",
            description: result.error,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Store user data
        if (result.token) {
          localStorage.setItem('auth_token', result.token);
        }
        if (result.userType) {
          localStorage.setItem('user_type', result.userType);
        }
        if (result.user) {
          localStorage.setItem('user_data', JSON.stringify(result.user));
        }

        // Show confetti celebration for employee activation!
        setShowConfetti(true);
        triggerConfetti();

        toast({
          title: "🎉 Account Activated!",
          description: "Welcome to the team! You can now access the portal.",
        });

        setFlow('success');
        setTimeout(() => {
          router.push("/portal");
          router.refresh();
        }, 3000); // Longer delay to enjoy confetti
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to activate account. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
      return;
    }

    // Customer registration OTP verification
    if (flow === 'otp-verify' && !userCheck?.exists) {
      const result = await verifyRegisterOTP(formData.email, otp);

      if (result.error) {
        toast({
          title: "Verification Failed",
          description: result.error,
          variant: "destructive",
        });
        setIsLoading(false);
      } else {
        toast({
          title: "Account Created!",
          description: "Welcome to ZOIRO Broast!",
        });
        setFlow('success');
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1500);
      }
      return;
    }

    // Login OTP verification
    const result = await verifyLoginOTP(formData.email, otp);

    if (result.error) {
      toast({
        title: "Verification Failed",
        description: result.error,
        variant: "destructive",
      });
      setIsLoading(false);
    } else {
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      const userType = result.userType;
      setTimeout(() => {
        if (userType === 'admin' || userType === 'employee') {
          router.push("/portal");
        } else {
          router.push("/");
        }
        router.refresh();
      }, 100);
    }
  };

  const handleBack = () => {
    if (flow === 'otp-verify') {
      if (userCheck?.isEmployee && userCheck?.needsActivation) {
        setFlow('employee-activate');
      } else if (userCheck?.exists) {
        setFlow(userCheck.isEmployee ? 'employee-login' : 'customer-login');
      } else {
        setFlow('customer-register');
      }
    } else {
      setFlow('initial');
      setUserCheck(null);
      setOtp("");
    }
  };

  const getTitle = () => {
    switch (flow) {
      case 'initial': return 'JOIN THE SQUAD';
      case 'customer-login': return 'WELCOME BACK';
      case 'customer-register': return 'JOIN THE CREW';
      case 'employee-login': return 'STAFF ACCESS';
      case 'employee-activate': return 'ACTIVATE';
      case 'otp-verify': return 'VERIFY';
      case 'success': return 'DONE!';
      default: return 'WELCOME';
    }
  };

  const getSubtitle = () => {
    switch (flow) {
      case 'initial': return 'THE CHASE STARTS WITH AN EMAIL';
      case 'customer-login': return 'GET BACK TO THE FLAVOUR';
      case 'customer-register': return 'BECOME PART OF THE LEGEND';
      case 'employee-login': return `VIBE CHECK${userCheck?.name ? `, ${userCheck.name}` : ''}`;
      case 'employee-activate': return 'STAFF ONLY AREA';
      case 'otp-verify': return 'SECURITY CHECK';
      case 'success': return 'YOU ARE IN';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#FFD200]">
      {/* Fifth Avenue Urban Background */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-[#008A45]"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 70% 100%)" }}
        />
        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* Left Side - Branding (Desktop) */}
        <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-xl text-center lg:text-left"
          >
            <Link href="/" className="inline-block mb-12">
               <div className="flex items-center gap-3">
                  <div className="bg-black p-4 border-4 border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <span className="font-bebas text-5xl text-white tracking-tighter">FIFTH AVENUE</span>
                  </div>
                  <div className="flex flex-col">

                    <span className="font-caveat text-2xl text-[#ED1C24] -mt-1">Chasing Flavours</span>
                  </div>
               </div>
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="font-bebas text-7xl lg:text-8xl text-black leading-[0.85] mb-8">
                {flow === 'employee-activate' || flow === 'employee-login' 
                  ? <>STAFF<br/><span className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">SQUAD</span></>
                  : <>THE<br/><span className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">LEGEND</span><br/>CONTINUES</>}
              </h2>
              <p className="font-source-sans text-xl font-bold text-black/80 max-w-md border-l-8 border-black pl-6">
                {flow === 'employee-activate' 
                  ? 'Ready to run the streets? Activate your squad ID and join the Fifth Avenue operation.'
                  : flow === 'employee-login'
                  ? 'Back on the block. Access your dashboard and keep the flavours moving.'
                  : 'Every signature broast has a story. Sign in to track your street cred and grab exclusive deals.'}
              </p>
            </motion.div>

            {/* Features - Blocky Style */}
            <div className="mt-12 grid grid-cols-2 gap-4">
               {[
                 { icon: Flame, label: "FIRE FLAVOURS" },
                 { icon: ShieldCheck, label: "SAFE & SECURE" },
               ].map((f, i) => (
                 <div key={i} className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3">
                    <f.icon className="w-6 h-6 text-[#ED1C24]" />
                    <span className="font-bebas text-lg tracking-widest">{f.label}</span>
                 </div>
               ))}
            </div>
          </motion.div>
        </div>

        <div className="flex-[1.5] flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl"
          >
             {/* Mobile Logo */}
             <div className="lg:hidden flex flex-col items-center mb-8">
                <Link href="/" className="flex items-center gap-2">
                    <div className="bg-black p-2 border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <span className="font-bebas text-2xl text-white">FIFTH AVENUE</span>
                    </div>

                </Link>
             </div>

            {/* Form Card - Fifth Avenue Style */}
            <div className="bg-white border-[8px] border-black p-6 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] relative">
               {/* Back Button */}
               {flow !== 'initial' && flow !== 'success' && (
                <button
                  onClick={handleBack}
                  className="absolute -top-6 -left-6 bg-[#FFD200] border-4 border-black p-2 hover:bg-black hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
              )}
              
               <Link 
                 href="/" 
                 className="absolute -top-6 -right-6 bg-black text-white border-4 border-[#FFD200] px-6 py-2 font-bebas text-2xl hover:bg-[#ED1C24] transition-colors shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
               >
                 HOME
               </Link>

              {/* Header */}
              <div className="text-center mb-6 border-b-8 border-black pb-4">
                <h2 className="font-bebas text-6xl text-black leading-none mb-1">
                  {getTitle()}
                </h2>
                <p className="font-caveat text-3xl text-[#ED1C24]">
                  {getSubtitle()}
                </p>
              </div>

              {/* Auth Error Banner */}
              {authError && (
                <div className="mb-6 p-4 bg-[#ED1C24] border-4 border-black text-white font-bebas text-lg tracking-widest relative">
                  {authError}
                  <button onClick={() => setAuthError(null)} className="absolute top-1 right-1"><X className="w-4 h-4" /></button>
                </div>
              )}

              <AnimatePresence mode="wait">
                {flow === 'initial' && (
                  <motion.form
                    key="initial"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleCheckEmail}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="email" className="font-bebas text-3xl text-black tracking-widest">EMAIL ADDRESS</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="WHO ARE YOU?"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="h-16 border-8 border-black rounded-none font-bebas text-3xl focus-visible:ring-0 focus-visible:bg-[#FFD200]/20 placeholder:text-black/20"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-16 bg-black text-white rounded-none font-bebas text-4xl tracking-widest hover:bg-[#ED1C24] border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,210,0,1)] hover:shadow-none transition-all"
                      >
                        {isLoading ? "..." : "GO"}
                      </Button>
                    </div>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t-4 border-black" /></div>
                      <div className="relative flex justify-center"><span className="px-4 bg-white font-bebas text-lg text-black/40 uppercase">Social Login</span></div>
                    </div>

                    <GoogleSignInButton type="login" disabled={isLoading} />

                    <div className="mt-4 p-3 bg-black/5 border-2 border-dashed border-black/20 text-center">
                      <p className="font-bebas text-sm text-black/60 tracking-widest leading-none">
                        BY CONTINUING, YOU AGREE TO OUR{" "}
                        <Link href="/terms" className="text-[#ED1C24] hover:underline font-bold">TERMS</Link>
                        {" "} & {" "}
                        <Link href="/privacy" className="text-[#ED1C24] hover:underline font-bold">PRIVACY POLICY</Link>
                      </p>
                    </div>
                  </motion.form>
                )}

                {(flow === 'customer-login' || flow === 'employee-login') && (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleLogin}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                      <div className="md:col-span-2 space-y-2">
                        <Label className="font-bebas text-3xl text-black tracking-widest">PASSWORD</Label>
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="SECRET CODE"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          className="h-16 border-8 border-black rounded-none font-bebas text-3xl focus-visible:ring-0 focus-visible:bg-[#FFD200]/20"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-16 bg-black text-white rounded-none font-bebas text-4xl tracking-widest hover:bg-[#ED1C24] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,138,69,1)] hover:shadow-none transition-all"
                      >
                        {isLoading ? "..." : "ENTER"}
                      </Button>
                    </div>
                    
                    <div className="text-center">
                       <Link href="/forgot-password" className="font-bebas text-lg text-[#ED1C24] hover:underline">FORGOT PASSWORD?</Link>
                    </div>

                    <div className="mt-4 p-3 bg-black/5 border-2 border-dashed border-black/20 text-center">
                      <p className="font-bebas text-sm text-black/60 tracking-widest leading-none">
                        BY CONTINUING, YOU AGREE TO OUR{" "}
                        <Link href="/terms" className="text-[#ED1C24] hover:underline font-bold">TERMS</Link>
                        {" "} & {" "}
                        <Link href="/privacy" className="text-[#ED1C24] hover:underline font-bold">PRIVACY POLICY</Link>
                      </p>
                    </div>
                  </motion.form>
                )}

                {flow === 'customer-register' && (
                  <motion.form
                    key="register"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleRegister}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="font-bebas text-2xl text-black">EMAIL</Label>
                          <Input
                            value={formData.email}
                            disabled
                            className="h-14 border-4 border-black rounded-none font-bebas text-2xl bg-gray-100 opacity-70"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-bebas text-2xl text-black">NAME</Label>
                          <Input
                            placeholder="NAME"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="h-14 border-4 border-black rounded-none font-bebas text-3xl focus-visible:ring-0"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-bebas text-2xl text-black">PHONE</Label>
                          <Input
                            placeholder="PHONE"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            className="h-14 border-4 border-black rounded-none font-bebas text-3xl focus-visible:ring-0"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="font-bebas text-2xl text-black">ADDRESS</Label>
                          <Textarea
                            placeholder="ADDRESS"
                            value={formData.address}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            className="min-h-[105px] border-4 border-black rounded-none font-bebas text-3xl focus-visible:ring-0 resize-none"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="font-bebas text-2xl text-black">PASS</Label>
                            <Input
                              type="password"
                              placeholder="PASS"
                              value={formData.password}
                              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                              className="h-14 border-4 border-black rounded-none font-bebas text-3xl focus-visible:ring-0"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="font-bebas text-2xl text-black">CONFIRM</Label>
                            <Input
                              type="password"
                              placeholder="CONFIRM"
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              className="h-14 border-4 border-black rounded-none font-bebas text-3xl focus-visible:ring-0"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-16 bg-[#008A45] text-white rounded-none font-bebas text-5xl tracking-widest hover:bg-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,210,0,1)] hover:shadow-none transition-all"
                      >
                        {isLoading ? "..." : "JOIN THE CREW"}
                      </Button>
                      
                      <div className="mt-4 p-3 bg-black/5 border-2 border-dashed border-black/20 text-center">
                        <p className="font-bebas text-sm text-black/60 tracking-widest leading-none">
                          BY JOINING, YOU AGREE TO OUR{" "}
                          <Link href="/terms" className="text-[#ED1C24] hover:underline font-bold">TERMS</Link>
                          {" "} & {" "}
                          <Link href="/privacy" className="text-[#ED1C24] hover:underline font-bold">PRIVACY POLICY</Link>
                        </p>
                      </div>
                    </div>
                  </motion.form>
                )}

                {flow === 'otp-verify' && (
                  <motion.form
                    key="otp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleVerifyOTP}
                    className="space-y-6"
                  >
                    <div className="space-y-2 text-center">
                      <Label className="font-bebas text-2xl text-black">THE MAGIC CODE</Label>
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="h-20 border-8 border-black rounded-none font-bebas text-5xl text-center tracking-[0.3em] focus-visible:ring-0"
                        maxLength={6}
                        required
                      />
                      <p className="font-source-sans text-sm font-bold text-black/40 uppercase mt-2">SENT TO {formData.email}</p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-16 bg-[#ED1C24] text-white rounded-none font-bebas text-3xl tracking-widest hover:bg-black border-2 border-black shadow-[6px_6px_0px_0px_rgba(255,210,0,1)]"
                    >
                      {isLoading ? "CHECKING..." : "CONFIRM"}
                    </Button>
                  </motion.form>
                )}

                {flow === 'success' && (
                   <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-24 h-24 bg-[#008A45] border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,210,0,1)] flex items-center justify-center mx-auto mb-6 transform -rotate-3">
                      <CheckCircle2 className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="font-bebas text-5xl text-black leading-none mb-2">YOU'RE IN!</h3>
                    <p className="font-caveat text-3xl text-[#ED1C24]">Welcome to the Fifth Avenue squad.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

        </div>
      </div>

      {/* 2FA Dialog */}
      {twoFAData && (
        <TwoFactorDialog
          open={show2FADialog}
          onClose={() => setShow2FADialog(false)}
          employeeId={twoFAData.employeeId}
          email={twoFAData.email}
          onSuccess={handle2FASuccess}
        />
      )}
    </div>
  );
}
