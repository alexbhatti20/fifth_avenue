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
  Sparkles,
  KeyRound,
  BadgeCheck,
  MapPin,
  ChefHat,
  Utensils,
  Clock,
  Star,
  Home,
  Flame,
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
        colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
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

      const result: UserCheckResult = await response.json();
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
        description: "Failed to check user. Please try again.",
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
      case 'initial': return 'Welcome';
      case 'customer-login': return 'Welcome Back';
      case 'customer-register': return 'Create Account';
      case 'employee-login': return 'Staff Login';
      case 'employee-activate': return 'Activate Account';
      case 'otp-verify': return 'Verify Email';
      case 'success': return 'Success!';
      default: return 'Welcome';
    }
  };

  const getSubtitle = () => {
    switch (flow) {
      case 'initial': return 'Enter your email to continue';
      case 'customer-login': return 'Sign in to your account';
      case 'customer-register': return 'Join ZOIRO Broast';
      case 'employee-login': return `Welcome back${userCheck?.name ? `, ${userCheck.name}` : ''}!`;
      case 'employee-activate': return 'Enter your employee license ID';
      case 'otp-verify': return 'Enter the code sent to your email';
      case 'success': return userCheck?.isEmployee ? 'Welcome to the team!' : 'Welcome to ZOIRO Broast!';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-zinc-950">
      {/* Advanced Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
        {/* Grid Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(239,68,68,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Animated gradient orbs - Red/Black theme - Only on desktop */}
        {!shouldReduceMotion && (
          <>
            <motion.div
              className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-red-900/30 to-red-600/20 blur-3xl"
              animate={{
                x: [0, 100, 0],
                y: [0, 50, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-red-800/25 to-orange-900/20 blur-3xl"
              animate={{
                x: [0, -80, 0],
                y: [0, -60, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-red-950/20 to-black/30 blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 30,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            
            {/* Additional Pulsing Orbs */}
            <motion.div
              className="absolute top-[20%] right-[20%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-yellow-600/10 to-orange-600/10 blur-3xl"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}
        
        {/* Static background orbs for mobile */}
        {shouldReduceMotion && (
          <>
            <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-red-900/20 to-red-600/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-gradient-to-tl from-red-800/15 to-orange-900/10 blur-3xl" />
          </>
        )}
        
        {/* Floating Particles - Only on desktop */}
        {!shouldReduceMotion && [
          { left: 10, top: 15, duration: 6, delay: 0.5 },
          { left: 25, top: 35, duration: 7, delay: 1.2 },
          { left: 45, top: 20, duration: 5.5, delay: 0.8 },
          { left: 60, top: 45, duration: 8, delay: 2.1 },
          { left: 75, top: 25, duration: 6.5, delay: 1.5 },
          { left: 85, top: 55, duration: 7.5, delay: 0.3 },
          { left: 15, top: 65, duration: 5, delay: 2.5 },
          { left: 35, top: 75, duration: 6.2, delay: 1.8 },
          { left: 55, top: 85, duration: 7.8, delay: 0.6 },
          { left: 70, top: 70, duration: 5.8, delay: 2.8 },
          { left: 90, top: 30, duration: 6.8, delay: 1.1 },
          { left: 5, top: 50, duration: 7.2, delay: 0.2 },
          { left: 30, top: 10, duration: 5.2, delay: 2.3 },
          { left: 50, top: 60, duration: 8.5, delay: 1.6 },
          { left: 80, top: 80, duration: 6.3, delay: 0.9 },
          { left: 20, top: 90, duration: 7.1, delay: 2.0 },
          { left: 40, top: 40, duration: 5.7, delay: 1.3 },
          { left: 65, top: 5, duration: 6.9, delay: 0.4 },
          { left: 95, top: 65, duration: 8.2, delay: 2.6 },
          { left: 12, top: 28, duration: 5.4, delay: 1.9 },
        ].map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-red-500/40 rounded-full"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              x: [-10, 10, -10],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Floating Broasted Chicken Images - Only on desktop */}
      {!shouldReduceMotion && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
          {/* Chicken Wings - Top Left */}
          <motion.div
            className="absolute top-[10%] left-[5%]"
            animate={{ 
              y: [0, -20, 0], 
              rotate: [0, 10, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image 
              src="/assets/wings.png" 
              alt="Wings" 
              width={120} 
              height={120}
              className="opacity-80 drop-shadow-2xl"
            />
          </motion.div>

          {/* Chicken Piece - Top Right */}
          <motion.div
            className="absolute top-[15%] right-[8%]"
            animate={{ 
              y: [0, 15, 0], 
              rotate: [0, -15, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Image 
              src="/assets/chicken-piece.png" 
              alt="Chicken" 
              width={100} 
              height={100}
              className="opacity-70 drop-shadow-2xl"
            />
          </motion.div>

          {/* Chicken Burger - Bottom Left */}
          <motion.div
            className="absolute bottom-[25%] left-[8%]"
            animate={{ 
              y: [0, -15, 0], 
              rotate: [0, 8, 0],
              scale: [1, 1.08, 1]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <Image 
              src="/assets/chicken-burger.png" 
              alt="Burger" 
              width={90} 
              height={90}
              className="opacity-70 drop-shadow-2xl"
            />
          </motion.div>

          {/* Fries - Bottom Right */}
          <motion.div
            className="absolute bottom-[15%] right-[10%]"
            animate={{ 
              y: [0, 20, 0], 
              rotate: [0, -10, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <Image 
              src="/assets/fries.png" 
              alt="Fries" 
              width={80} 
              height={80}
              className="opacity-70 drop-shadow-2xl"
            />
          </motion.div>

          {/* Drink - Middle Left */}
          <motion.div
            className="absolute top-[55%] left-[3%]"
            animate={{ 
              y: [0, -25, 0], 
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          >
            <Image 
              src="/assets/drink.png" 
              alt="Drink" 
              width={70} 
              height={70}
              className="opacity-60 drop-shadow-2xl"
            />
          </motion.div>

          {/* Floating Icons */}
          <motion.div
            className="absolute top-[40%] right-[5%] text-red-500/30"
            animate={{ y: [0, 15, 0], rotate: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Flame className="w-10 h-10" />
          </motion.div>
          <motion.div
            className="absolute bottom-[40%] left-[12%] text-red-600/25"
            animate={{ y: [0, -15, 0], rotate: [0, 15, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <Star className="w-8 h-8" />
          </motion.div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Branding (Desktop) */}
        <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-lg"
          >
            {/* Animated Mascot Logo */}
            <Link href="/" className="block mb-10">
              <motion.div 
                className="relative w-48 h-48 mx-auto"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              >
                {/* Glow Effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-red-500/40 to-red-700/40 rounded-full blur-3xl"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Rotating Ring */}
                <motion.div
                  className="absolute inset-[-10px] border-4 border-dashed border-red-500/30 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                {/* Main Logo */}
                <motion.div
                  className="relative w-full h-full"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                    scale: { type: "spring", stiffness: 400 },
                  }}
                >
                  <Image
                    src="/assets/zoiro-logo.png"
                    alt="Zoiro Broast"
                    fill
                    sizes="120px"
                    className="object-contain drop-shadow-2xl"
                    priority
                  />
                </motion.div>
                {/* Sparkle Effects */}
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                    style={{
                      top: `${20 + i * 15}%`,
                      left: `${10 + i * 20}%`,
                    }}
                    animate={{
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.4,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </motion.div>
            </Link>

            {/* Hero Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <h2 className="text-5xl lg:text-6xl font-bebas text-white mb-4 leading-tight text-center">
                {flow === 'employee-activate' || flow === 'employee-login' 
                  ? <>Staff<br/><span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">Portal</span></>
                  : <>Delicious<br/><span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">Broast Awaits</span></>}
              </h2>
              <p className="text-zinc-400 text-lg max-w-md leading-relaxed text-center">
                {flow === 'employee-activate' 
                  ? 'Activate your employee account to access the staff portal and start managing operations.'
                  : flow === 'employee-login'
                  ? 'Access your staff dashboard and manage restaurant operations efficiently.'
                  : 'Order crispy, juicy broasted chicken, track your orders in real-time, and earn loyalty points with every purchase.'}
              </p>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-12 grid grid-cols-2 gap-4"
            >
              {[
                { icon: Sparkles, label: "Crispy & Juicy", color: "from-red-600 to-red-500" },
                { icon: ShieldCheck, label: "Secure Login", color: "from-emerald-600 to-emerald-500" },
                { icon: BadgeCheck, label: "Loyalty Points", color: "from-amber-600 to-amber-500" },
                { icon: MapPin, label: "Fast Delivery", color: "from-blue-600 to-blue-500" },
              ].map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg`}>
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-zinc-300 text-sm font-medium">{feature.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Food Quality Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-12 relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-red-500/20 rounded-3xl blur-2xl" />
              <div className="relative bg-zinc-800/60 backdrop-blur-sm rounded-3xl p-6 border border-zinc-700/50">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-500/20 flex items-center justify-center overflow-hidden">
                    <ChefHat className="w-10 h-10 text-red-500" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Premium Quality</p>
                    <p className="text-zinc-400 text-sm">Freshly prepared with love</p>
                    <div className="flex items-center gap-1 mt-1">
                      {[1,2,3,4,5].map((star) => (
                        <Star key={star} className="w-4 h-4 fill-red-500 text-red-500" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Right Side - Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Mobile Logo - Simplified for performance */}
            <div className="lg:hidden flex flex-col items-center justify-center mb-8">
              <Link href="/" className="block">
                <div className="relative w-32 h-32 mx-auto mb-2">
                  {/* Static Glow Effect for Mobile */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-red-700/30 rounded-full blur-2xl opacity-50" />
                  {/* Mobile Logo - Static */}
                  <div className="relative w-full h-full">
                    <Image
                      src="/assets/zoiro-logo.png"
                      alt="Zoiro Broast"
                      fill
                      sizes="80px"
                      className="object-contain drop-shadow-xl"
                      priority
                    />
                  </div>
                </div>
              </Link>
            </div>

            {/* Form Card */}
            <motion.div 
              className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-red-900/10 border border-zinc-800"
              layout
            >
              {/* Back to Home Button */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <Link 
                  href="/"
                  className="inline-flex items-center gap-2 text-zinc-500 hover:text-red-400 transition-colors group text-sm font-medium"
                >
                  <Home className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  <span>Back to Home</span>
                </Link>
              </motion.div>

              {/* Back Button */}
              {flow !== 'initial' && flow !== 'success' && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={handleBack}
                  className="flex items-center gap-2 text-zinc-500 hover:text-white mb-6 transition-colors group"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-sm font-medium">Back</span>
                </motion.button>
              )}

              {/* Auth Error Banner */}
              {authError && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <ShieldCheck className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-red-300 text-sm font-medium leading-relaxed">{authError}</p>
                    </div>
                    <button
                      onClick={() => setAuthError(null)}
                      className="shrink-0 text-red-400/60 hover:text-red-300 transition-colors"
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Header */}
              <div className="text-center mb-8">
                <motion.h2 
                  key={flow}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bebas bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent"
                >
                  {getTitle()}
                </motion.h2>
                <motion.p 
                  key={`${flow}-sub`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-zinc-500 text-sm mt-2"
                >
                  {getSubtitle()}
                </motion.p>
              </div>

              <AnimatePresence mode="wait">
                {/* Initial - Email Check */}
                {flow === 'initial' && (
                  <motion.form
                    key="initial"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleCheckEmail}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-zinc-300 font-medium">Email Address</Label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="pl-12 h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 transition-all placeholder:text-zinc-600"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all hover:shadow-xl hover:shadow-red-600/40"
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
                          Continue
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>

                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-700" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-zinc-900/80 text-zinc-500">or continue with</span>
                      </div>
                    </div>

                    {/* Google Sign In */}
                    <GoogleSignInButton 
                      type="login"
                      disabled={isLoading}
                    />

                    <div className="text-center">
                      <Link href="/" className="text-sm text-zinc-500 hover:text-red-500 transition-colors inline-flex items-center gap-1">
                        <Home className="w-4 h-4" />
                        Back to Home
                      </Link>
                    </div>
                  </motion.form>
                )}

                {/* Customer/Employee Login */}
                {(flow === 'customer-login' || flow === 'employee-login') && (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleLogin}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <Label className="text-zinc-300 font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input
                          type="email"
                          value={formData.email}
                          disabled
                          className="pl-12 h-12 bg-zinc-800/30 border-zinc-700 text-zinc-500 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-zinc-300 font-medium">Password</Label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          className="pl-12 pr-12 h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 placeholder:text-zinc-600"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {/* Forgot Password Link */}
                      <div className="text-right">
                        <Link 
                          href="/forgot-password" 
                          className="text-sm text-red-500 hover:text-red-400 transition-colors hover:underline"
                        >
                          Forgot Password?
                        </Link>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all hover:shadow-xl hover:shadow-red-600/40"
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
                          Sign In
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>

                    {/* Google Sign In for Login - only for customers */}
                    {flow === 'customer-login' && (
                      <>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-700" />
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-zinc-900/80 text-zinc-500">or</span>
                          </div>
                        </div>
                        <GoogleSignInButton 
                          type="login"
                          disabled={isLoading}
                        />
                      </>
                    )}
                  </motion.form>
                )}

                {/* Customer Registration */}
                {flow === 'customer-register' && (
                  <motion.form
                    key="register"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleRegister}
                    className="space-y-4"
                  >
                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-zinc-300 font-medium">Full Name <span className="text-red-500">*</span></Label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                        <Input
                          id="name"
                          placeholder="John Doe"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="pl-12 h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 placeholder:text-zinc-600"
                          required
                        />
                      </div>
                    </div>

                    {/* Email (disabled) */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input
                          type="email"
                          value={formData.email}
                          disabled
                          className="pl-12 h-12 bg-zinc-800/30 border-zinc-700 text-zinc-500 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-zinc-300 font-medium">Phone Number <span className="text-red-500">*</span></Label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          placeholder="03001234567"
                          value={formData.phone}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            if (value.length <= 13) {
                              setFormData(prev => ({ ...prev, phone: value }));
                            }
                          }}
                          maxLength={13}
                          className="pl-12 h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 placeholder:text-zinc-600"
                          required
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-zinc-300 font-medium">
                        Delivery Address
                        <span className="text-zinc-500 text-xs ml-2">(Optional)</span>
                      </Label>
                      <div className="relative group">
                        <MapPin className="absolute left-4 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                        <Textarea
                          id="address"
                          placeholder="Enter your delivery address..."
                          value={formData.address}
                          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                          className="pl-12 min-h-[80px] bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 resize-none placeholder:text-zinc-600"
                        />
                      </div>
                    </div>

                    {/* Passwords */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-zinc-300 font-medium text-sm">Password <span className="text-red-500">*</span></Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter password"
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            className="pl-10 pr-10 h-12 sm:h-11 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 text-base sm:text-sm placeholder:text-zinc-600"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-500 transition-colors p-1"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-zinc-300 font-medium text-sm">Confirm Password <span className="text-red-500">*</span></Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                          <Input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="Confirm password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="pl-10 pr-10 h-12 sm:h-11 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-red-500 focus:ring-red-500/20 text-base sm:text-sm placeholder:text-zinc-600"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-500 transition-colors p-1"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all hover:shadow-xl hover:shadow-red-600/40"
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
                          Create Account
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>

                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-700" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-zinc-900/80 text-zinc-500">or sign up with</span>
                      </div>
                    </div>

                    {/* Google Sign Up */}
                    <GoogleSignInButton 
                      type="register"
                      disabled={isLoading}
                    />
                  </motion.form>
                )}

                {/* Employee Activation */}
                {flow === 'employee-activate' && (
                  <motion.form
                    key="activate"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleValidateLicense}
                    className="space-y-5"
                  >
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <p className="text-emerald-400 text-sm">
                        <strong>Hi {userCheck?.name || 'there'}!</strong> You need to activate your employee account. 
                        Enter the license ID sent to your email.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-300 font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input
                          type="email"
                          value={formData.email}
                          disabled
                          className="pl-12 h-12 bg-zinc-800/30 border-zinc-700 text-zinc-500 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="licenseId" className="text-zinc-300 font-medium">Employee License ID</Label>
                      <div className="relative group">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                        <Input
                          id="licenseId"
                          placeholder="LIC-XXXX-XXXX-XXXX"
                          value={formData.licenseId}
                          onChange={(e) => setFormData(prev => ({ ...prev, licenseId: e.target.value.toUpperCase() }))}
                          className="pl-12 h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 uppercase font-mono placeholder:text-zinc-600"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/30 transition-all hover:shadow-xl"
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
                          Validate License
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </motion.form>
                )}

                {/* OTP Verification */}
                {flow === 'otp-verify' && (
                  <motion.form
                    key="otp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleVerifyOTP}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="otp" className="text-zinc-300 font-medium">Verification Code</Label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                        <Input
                          id="otp"
                          placeholder="Enter 6-digit code"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="pl-12 h-14 bg-zinc-800/50 border-zinc-700 text-white rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:border-red-500 focus:ring-red-500/20 placeholder:text-zinc-600 placeholder:text-base placeholder:tracking-normal"
                          maxLength={6}
                          required
                        />
                      </div>
                      <p className="text-xs text-zinc-500 text-center">
                        Code sent to {formData.email}
                      </p>
                    </div>

                    {/* Password fields for employee activation */}
                    {userCheck?.isEmployee && userCheck?.needsActivation && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="newPassword" className="text-zinc-300 font-medium">Create Password</Label>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                            <Input
                              id="newPassword"
                              type={showPassword ? "text" : "password"}
                              placeholder="Create a strong password"
                              value={formData.password}
                              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                              className="pl-12 pr-12 h-14 sm:h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 placeholder:text-zinc-600 text-base"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-emerald-500 transition-colors p-1"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmNewPassword" className="text-zinc-300 font-medium">Confirm Password</Label>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                            <Input
                              id="confirmNewPassword"
                              type={showPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              className="pl-12 pr-12 h-14 sm:h-12 bg-zinc-800/50 border-zinc-700 text-white rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 placeholder:text-zinc-600 text-base"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-emerald-500 transition-colors p-1"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    <Button
                      type="submit"
                      className={`w-full h-12 ${
                        userCheck?.isEmployee 
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-600/30' 
                          : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-600/30'
                      } text-white rounded-xl font-semibold shadow-lg transition-all hover:shadow-xl`}
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
                          {userCheck?.isEmployee && userCheck?.needsActivation ? "Activate Account" : "Verify & Continue"}
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </motion.form>
                )}

                {/* Success */}
                {flow === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div 
                      className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl ${
                        userCheck?.isEmployee && userCheck?.needsActivation 
                          ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/30' 
                          : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30'
                      }`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {userCheck?.isEmployee && userCheck?.needsActivation ? (
                          <BadgeCheck className="h-12 w-12 text-white" />
                        ) : (
                          <Sparkles className="h-12 w-12 text-white" />
                        )}
                      </motion.div>
                    </motion.div>
                    <motion.h2 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className={`text-3xl font-bebas bg-clip-text text-transparent mb-3 ${
                        userCheck?.isEmployee && userCheck?.needsActivation
                          ? 'bg-gradient-to-r from-red-400 to-orange-400'
                          : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                      }`}
                    >
                      {userCheck?.isEmployee && userCheck?.needsActivation 
                        ? "🎉 Account Activated!" 
                        : userCheck?.isEmployee 
                          ? "Welcome Back!" 
                          : "Welcome to ZOIRO Broast!"}
                    </motion.h2>
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-zinc-500"
                    >
                      {userCheck?.isEmployee && userCheck?.needsActivation 
                        ? "Your portal is ready. Redirecting to dashboard..."
                        : "Redirecting you now..."}
                    </motion.p>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ delay: 0.5, duration: userCheck?.isEmployee && userCheck?.needsActivation ? 2.5 : 1 }}
                      className={`h-1 rounded-full mt-6 mx-auto max-w-[200px] ${
                        userCheck?.isEmployee && userCheck?.needsActivation
                          ? 'bg-gradient-to-r from-red-500 to-orange-400'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      }`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Footer */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center text-zinc-600 text-sm mt-6"
            >
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-red-500 hover:text-red-400 hover:underline transition-colors">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-red-500 hover:text-red-400 hover:underline transition-colors">Privacy Policy</Link>
            </motion.p>
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
