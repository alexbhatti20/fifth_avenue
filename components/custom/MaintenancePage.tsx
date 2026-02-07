'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wrench, Clock, RefreshCw, AlertCircle, Zap, 
  Settings2, Bug, Sparkles, Calendar, Coffee,
  Timer, Mail, Phone, ArrowRight, CheckCircle2
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

// Maintenance reason icons and colors
const REASON_CONFIG: Record<string, { icon: typeof Wrench; color: string; gradient: string; label: string }> = {
  update: { 
    icon: RefreshCw, 
    color: 'text-blue-500', 
    gradient: 'from-blue-500 to-cyan-500',
    label: 'System Update'
  },
  bug_fix: { 
    icon: Bug, 
    color: 'text-orange-500', 
    gradient: 'from-orange-500 to-amber-500',
    label: 'Bug Fix'
  },
  changes: { 
    icon: Sparkles, 
    color: 'text-purple-500', 
    gradient: 'from-purple-500 to-pink-500',
    label: 'Improvements'
  },
  scheduled: { 
    icon: Calendar, 
    color: 'text-green-500', 
    gradient: 'from-green-500 to-emerald-500',
    label: 'Scheduled Maintenance'
  },
  custom: { 
    icon: Settings2, 
    color: 'text-primary', 
    gradient: 'from-primary to-orange-500',
    label: 'Maintenance'
  },
};

interface MaintenancePageProps {
  reasonType?: string;
  customReason?: string;
  title?: string;
  message?: string;
  estimatedRestoreTime?: string;
  showTimer?: boolean;
  showProgress?: boolean;
  enabledAt?: string;
}

// Animated gear component
const AnimatedGear = memo(function AnimatedGear({ 
  size = 120, 
  direction = 1, 
  delay = 0,
  className = ''
}: { size?: number; direction?: number; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      animate={{ rotate: direction * 360 }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: 'linear',
        delay,
      }}
    >
      <Settings2 size={size} className="text-primary/20" />
    </motion.div>
  );
});

// Countdown timer component
const CountdownTimer = memo(function CountdownTimer({ 
  targetTime,
  onExpired
}: { targetTime: string; onExpired?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    setMounted(true);
    const target = new Date(targetTime).getTime();

    // Check if already expired on mount
    if (target <= Date.now()) {
      setIsExpired(true);
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft(null);
        // Notify parent and auto-refresh after a short delay
        if (onExpired) {
          setTimeout(() => onExpired(), 3000);
        }
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetTime, onExpired]);

  // Don't render until mounted to avoid hydration mismatch with Date
  if (!mounted) {
    return (
      <div className="flex gap-3 sm:gap-4">
        {['Days', 'Hrs', 'Min', 'Sec'].map((label) => (
          <div key={label} className="flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center shadow-lg border border-zinc-700/50">
              <span className="text-2xl sm:text-3xl font-bold text-white font-mono">--</span>
            </div>
            <span className="text-xs text-zinc-500 mt-1">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (isExpired) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="flex items-center gap-2 text-green-500 font-semibold">
          <CheckCircle2 className="w-5 h-5 animate-pulse" />
          <span>Maintenance should be complete!</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Checking status...</span>
        </div>
      </motion.div>
    );
  }

  if (!timeLeft) return null;

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <motion.div
      key={value}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center"
    >
      <div className="relative">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center shadow-lg border border-zinc-700/50">
          <span className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {String(value).padStart(2, '0')}
          </span>
        </div>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
      </div>
      <span className="text-xs sm:text-sm text-muted-foreground mt-2 uppercase tracking-wide">
        {label}
      </span>
    </motion.div>
  );

  return (
    <div className="flex gap-3 sm:gap-4">
      {timeLeft.days > 0 && <TimeBlock value={timeLeft.days} label="Days" />}
      <TimeBlock value={timeLeft.hours} label="Hours" />
      <div className="flex items-center text-3xl text-primary font-bold animate-pulse self-start mt-4">:</div>
      <TimeBlock value={timeLeft.minutes} label="Mins" />
      <div className="flex items-center text-3xl text-primary font-bold animate-pulse self-start mt-4">:</div>
      <TimeBlock value={timeLeft.seconds} label="Secs" />
    </div>
  );
});

// Progress bar component
const ProgressBar = memo(function ProgressBar({ 
  startTime, 
  endTime 
}: { startTime: string; endTime: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const total = end - start;

    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - start;
      const newProgress = Math.min(100, Math.max(0, (elapsed / total) * 100));
      setProgress(newProgress);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-between text-sm text-muted-foreground mb-2">
        <span>Progress</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-orange-500 to-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
          style={{
            backgroundSize: '200% 100%',
            animation: 'gradient-shift 3s ease infinite',
          }}
        />
      </div>
    </div>
  );
});

// Floating particles - client only to avoid hydration mismatch
const FloatingParticles = memo(function FloatingParticles() {
  const [particles, setParticles] = useState<Array<{
    id: number;
    size: number;
    x: number;
    y: number;
    duration: number;
    delay: number;
    xOffset: number;
  }>>([]);

  // Generate particles only on client side to avoid SSR hydration mismatch
  useEffect(() => {
    const generated = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 10 + 15,
      delay: Math.random() * 5,
      xOffset: Math.random() * 50 - 25,
    }));
    setParticles(generated);
  }, []);

  // Don't render on server or before client particles are generated
  if (particles.length === 0) {
    return <div className="fixed inset-0 pointer-events-none overflow-hidden" />;
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary/20"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, p.xOffset, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
});

function MaintenancePage({
  reasonType = 'update',
  customReason,
  title = "We'll Be Right Back",
  message = 'Our website is currently undergoing maintenance. We apologize for any inconvenience.',
  estimatedRestoreTime,
  showTimer = true,
  showProgress = true,
  enabledAt,
}: MaintenancePageProps) {
  const config = REASON_CONFIG[reasonType] || REASON_CONFIG.custom;
  const Icon = config.icon;
  const displayReason = reasonType === 'custom' && customReason ? customReason : config.label;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Floating particles background */}
      <FloatingParticles />
      
      {/* Animated gears background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AnimatedGear size={200} direction={1} delay={0} className="absolute -top-20 -left-20" />
        <AnimatedGear size={150} direction={-1} delay={2} className="absolute top-1/4 -right-16" />
        <AnimatedGear size={100} direction={1} delay={4} className="absolute bottom-1/4 -left-10" />
        <AnimatedGear size={180} direction={-1} delay={1} className="absolute -bottom-20 right-1/4" />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/80 pointer-events-none" />
      
      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center max-w-2xl mx-auto"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            <Image
              src="/assets/logo.png"
              alt="ZOIRO Injected Broast"
              width={120}
              height={120}
              className="mx-auto drop-shadow-2xl"
              priority
            />
            <motion.div
              className="absolute -inset-4 bg-primary/20 rounded-full blur-xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </div>
        </motion.div>

        {/* Animated icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: 0.3 }}
          className="mb-6"
        >
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br ${config.gradient} shadow-2xl`}>
            <Icon className="w-10 h-10 text-white" />
          </div>
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-4"
        >
          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-sm font-medium ${config.color}`}>
            <Wrench className="w-4 h-4" />
            {displayReason}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4"
        >
          {title}
        </motion.h1>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-lg sm:text-xl text-zinc-400 mb-8 max-w-lg mx-auto"
        >
          {message}
        </motion.p>

        {/* Timer */}
        {showTimer && estimatedRestoreTime && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Clock className="w-4 h-4" />
              <span>Estimated time to completion</span>
            </div>
            <div className="flex justify-center">
              <CountdownTimer 
                targetTime={estimatedRestoreTime} 
                onExpired={() => {
                  // Auto-refresh the page when timer expires (maintenance might be over)
                  window.location.reload();
                }}
              />
            </div>
          </motion.div>
        )}

        {/* Progress bar */}
        {showProgress && enabledAt && estimatedRestoreTime && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-8 flex justify-center"
          >
            <ProgressBar startTime={enabledAt} endTime={estimatedRestoreTime} />
          </motion.div>
        )}

        {/* Contact info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-8"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-zinc-400">
              <Coffee className="w-4 h-4" />
              <span className="text-sm">Need to order?</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="tel:+923001234567" 
                className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="font-medium">+92 300 1234567</span>
              </a>
            </div>
          </div>
        </motion.div>

        {/* Refresh button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="rounded-xl border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600 transition-all"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Page
          </Button>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-6 text-center flex flex-col items-center gap-3"
      >
        <motion.a
          href="https://waqarx.me"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:scale-105"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.96 }}
          style={{
            background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)',
            border: '1px solid transparent',
            backgroundClip: 'padding-box',
          }}
        >
          {/* Animated border gradient */}
          <span className="absolute inset-0 rounded-full p-[1px] -z-10" style={{ background: 'linear-gradient(270deg, #a855f7, #ec4899, #3b82f6, #06b6d4, #a855f7)', backgroundSize: '300% 300%', animation: 'devBorderShift 4s ease infinite' }} />
          <span className="absolute inset-[1px] rounded-full bg-zinc-950/90 -z-10" />
          {/* Shimmer sweep */}
          <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(168,85,247,0.15) 45%, rgba(236,72,153,0.1) 55%, transparent 60%)', backgroundSize: '200% 100%', animation: 'devShimmer 2s ease-in-out infinite' }} />
          <svg className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-300 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">Developer</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        </motion.a>
        <p className="text-zinc-600 text-sm">© {new Date().getFullYear()} ZOIRO Injected Broast. All rights reserved.</p>
      </motion.div>

      <style jsx global>{`
        @keyframes devBorderShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes devShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Animated border gradient */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50" />
    </div>
  );
}

export default memo(MaintenancePage);
