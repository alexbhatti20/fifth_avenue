"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { 
  Sparkles, Star, Crown, Gift, Percent, Truck, Clock, Shield, 
  ChefHat, Heart, Bell, Zap, Award, Users, TrendingUp, 
  ArrowRight, Check, Play, Pause
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePerformanceMode } from "@/hooks/useReducedMotion";

// ============================================
// WebGL Background Component (Only for high-performance devices)
// ============================================
const WebGLBackground = ({ enabled }: { enabled: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    life: number;
    maxLife: number;
  }>>([]);

  useEffect(() => {
    if (!enabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles - reduced count for better performance
    const initParticles = () => {
      particlesRef.current = [];
      const particleCount = Math.min(40, Math.floor(window.innerWidth / 40));
      
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 1,
          color: Math.random() > 0.5 ? "rgba(239, 68, 68, 0.6)" : "rgba(251, 146, 60, 0.4)",
          life: Math.random() * 100,
          maxLife: 100 + Math.random() * 100,
        });
      }
    };
    initParticles();

    // Mouse movement - throttled
    let lastMouseUpdate = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMouseUpdate > 50) { // Throttle to 20fps
        mouseRef.current = { x: e.clientX, y: e.clientY };
        lastMouseUpdate = now;
      }
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Animation loop
    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Simplified mouse attraction
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150;
          particle.vx += (dx / dist) * force * 0.01;
          particle.vy += (dy / dist) * force * 0.01;
        }

        // Apply friction
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Update life
        particle.life++;
        if (particle.life > particle.maxLife) {
          particle.life = 0;
        }

        // Draw particle (no connections for better performance)
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ background: "transparent" }}
    />
  );
};

// ============================================
// 3D Rotating Card Component (Simplified for low-end devices)
// ============================================
const Feature3DCard = ({ 
  icon: Icon, 
  title, 
  description, 
  gradient,
  delay = 0,
  enableEffects = true,
}: {
  icon: any;
  title: string;
  description: string;
  gradient: string;
  delay?: number;
  enableEffects?: boolean;
}) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableEffects || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    setRotateX((y - centerY) / 15);
    setRotateY((centerX - x) / 15);
  }, [enableEffects]);

  const handleMouseLeave = useCallback(() => {
    setRotateX(0);
    setRotateY(0);
  }, []);

  // Simplified version for low-end devices
  if (!enableEffects) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, delay: delay * 0.5 }}
        className="relative"
      >
        <div className={`relative p-6 md:p-8 rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 shadow-xl`}>
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-xl font-bebas text-white mb-2">{title}</h3>
          <p className="text-white/70 text-sm leading-relaxed">{description}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative group cursor-pointer"
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: "preserve-3d",
        transition: "transform 0.1s ease-out",
      }}
    >
      <div className={`relative p-8 rounded-3xl bg-gradient-to-br ${gradient} border border-white/10 shadow-2xl overflow-hidden`}>
        {/* Shine effect */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at ${50 - rotateY * 2}% ${50 + rotateX * 2}%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
          }}
        />
        
        {/* Icon */}
        <motion.div
          className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6"
          style={{ transform: "translateZ(40px)" }}
          whileHover={{ scale: 1.1, rotate: 5 }}
        >
          <Icon className="w-8 h-8 text-white" />
        </motion.div>
        
        <h3 
          className="text-2xl font-bebas text-white mb-3"
          style={{ transform: "translateZ(30px)" }}
        >
          {title}
        </h3>
        <p 
          className="text-white/70 leading-relaxed"
          style={{ transform: "translateZ(20px)" }}
        >
          {description}
        </p>
      </div>
    </motion.div>
  );
};

// ============================================
// Animated Counter Component
// ============================================
const AnimatedCounter = ({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
};

// ============================================
// Feature Benefits Data
// ============================================
const MEMBER_BENEFITS = [
  {
    icon: Crown,
    title: "VIP Priority Orders",
    description: "Your orders are prepared first! Skip the queue and get your food faster with our priority processing system.",
    gradient: "from-amber-500/20 to-amber-600/10",
  },
  {
    icon: Percent,
    title: "Exclusive Discounts",
    description: "Unlock member-only deals up to 30% off. Access flash sales and special occasion discounts not available to guests.",
    gradient: "from-red-500/20 to-red-600/10",
  },
  {
    icon: Gift,
    title: "Birthday Rewards",
    description: "Celebrate your special day with a FREE meal! Get a complimentary item from our menu during your birthday month.",
    gradient: "from-pink-500/20 to-pink-600/10",
  },
  {
    icon: Star,
    title: "Loyalty Points",
    description: "Earn 1 point for every Rs. 10 spent. Redeem points for free items, upgrades, and exclusive merchandise.",
    gradient: "from-purple-500/20 to-purple-600/10",
  },
  {
    icon: Truck,
    title: "Free Delivery",
    description: "No minimum order for free delivery! Members enjoy complimentary delivery on all orders, anytime.",
    gradient: "from-blue-500/20 to-blue-600/10",
  },
  {
    icon: Bell,
    title: "Early Access",
    description: "Be the first to try new menu items! Get exclusive early access to seasonal specials and limited-edition offerings.",
    gradient: "from-green-500/20 to-green-600/10",
  },
];

const STATS = [
  { value: 5000, suffix: "+", label: "Happy Members" },
  { value: 30, suffix: "%", label: "Average Savings" },
  { value: 15, suffix: " mins", label: "Priority Wait Time" },
  { value: 100, suffix: "+", label: "Exclusive Deals" },
];

// ============================================
// Main Features Page Component
// ============================================
export default function FeaturesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  
  // Performance detection
  const { shouldReduce, canUseWebGL, canUseParallax, performanceLevel } = usePerformanceMode();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Only use parallax transforms on capable devices
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, canUseParallax ? 0 : 1]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, canUseParallax ? 0.95 : 1]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, canUseParallax ? -50 : 0]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-hidden relative pt-20" ref={containerRef}>
        {/* WebGL Background - Only on high-performance devices */}
        <WebGLBackground enabled={canUseWebGL} />

        {/* Hero Section */}
        <motion.section 
          ref={heroRef}
          className="relative min-h-screen flex items-center justify-center pt-20 pb-20"
          style={canUseParallax ? { opacity: heroOpacity, scale: heroScale, y: heroY } : {}}
        >
          {/* Animated gradient orbs - Only on capable devices */}
          {!shouldReduce && (
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-gradient-to-br from-red-600/30 to-orange-500/20 rounded-full blur-[100px]"
                animate={{
                  x: [0, 100, 0],
                  y: [0, 50, 0],
                  scale: [1, 1.2, 1],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-purple-600/20 to-pink-500/15 rounded-full blur-[120px]"
                animate={{
                  x: [0, -80, 0],
                  y: [0, -60, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          )}
          
          {/* Static gradient background for low-end devices */}
          {shouldReduce && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] bg-gradient-to-br from-red-600/20 to-orange-500/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-600/15 to-pink-500/10 rounded-full blur-[100px]" />
            </div>
          )}

          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
              backgroundSize: '80px 80px',
            }}
          />

          {/* Floating Food Images - Only on capable devices */}
          {!shouldReduce && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <motion.div
                className="absolute top-[15%] right-[5%] w-32 md:w-44"
                animate={{ y: [0, -20, 0], rotate: [0, 8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image
                  src="/assets/chicken-burger.png"
                  alt="Chicken Burger"
                  width={180}
                  height={180}
                  className="drop-shadow-2xl opacity-80"
                />
              </motion.div>
              <motion.div
                className="absolute bottom-[20%] left-[3%] w-28 md:w-36"
                animate={{ y: [0, 15, 0], rotate: [0, -6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <Image
                  src="/assets/wings.png"
                  alt="Chicken Wings"
                  width={150}
                  height={150}
                  className="drop-shadow-2xl opacity-70"
                />
              </motion.div>
              <motion.div
                className="absolute top-[40%] left-[8%] w-20 md:w-28"
                animate={{ y: [0, -12, 0], rotate: [0, 10, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <Image
                  src="/assets/fries.png"
                  alt="Fries"
                  width={120}
                  height={120}
                  className="drop-shadow-2xl opacity-60"
                />
              </motion.div>
              <motion.div
                className="absolute bottom-[30%] right-[8%] w-24 md:w-32"
                animate={{ y: [0, 18, 0], rotate: [0, -8, 0] }}
                transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
              >
                <Image
                  src="/assets/drink.png"
                  alt="Drink"
                  width={130}
                  height={130}
                  className="drop-shadow-2xl opacity-70"
                />
              </motion.div>
            </div>
          )}
          
          {/* Static food images for low-end devices */}
          {shouldReduce && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
              <div className="absolute top-[15%] right-[5%] w-32 md:w-40">
                <Image
                  src="/assets/chicken-burger.png"
                  alt="Chicken Burger"
                  width={160}
                  height={160}
                  className="drop-shadow-xl opacity-60"
                />
              </div>
              <div className="absolute bottom-[20%] left-[3%] w-28 md:w-32">
                <Image
                  src="/assets/wings.png"
                  alt="Chicken Wings"
                  width={130}
                  height={130}
                  className="drop-shadow-xl opacity-50"
                />
              </div>
            </div>
          )}

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-5xl mx-auto text-center">
              {/* Floating Badge */}
              <motion.div
                initial={{ opacity: 0, y: shouldReduce ? 10 : 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduce ? 0.3 : 0.6 }}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-full px-6 py-3 mb-8"
              >
                {!shouldReduce ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  >
                    <Crown className="w-5 h-5 text-amber-400" />
                  </motion.div>
                ) : (
                  <Crown className="w-5 h-5 text-amber-400" />
                )}
                <span className="text-amber-300 font-semibold">Become a ZOIRO Member</span>
                {!shouldReduce ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </motion.div>
                ) : (
                  <Sparkles className="w-5 h-5 text-amber-400" />
                )}
              </motion.div>

              {/* ZOIRO Brand Logo */}
              <motion.div
                initial={{ opacity: 0, scale: shouldReduce ? 0.9 : 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: shouldReduce ? 0.3 : 0.8, type: shouldReduce ? "tween" : "spring" }}
                className="relative mb-8"
              >
                {!shouldReduce ? (
                  <motion.div
                    animate={{ 
                      boxShadow: [
                        "0 0 40px rgba(239,68,68,0.3)",
                        "0 0 80px rgba(251,146,60,0.4)",
                        "0 0 40px rgba(239,68,68,0.3)"
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="relative inline-block rounded-full p-2"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-2 border-dashed border-red-500/30"
                    />
                    <Image
                      src="/assets/zoiro-logo.png"
                      alt="ZOIRO Broast"
                      width={120}
                      height={120}
                      className="relative z-10 drop-shadow-2xl"
                    />
                  </motion.div>
                ) : (
                  <div className="relative inline-block rounded-full p-2" style={{ boxShadow: "0 0 40px rgba(239,68,68,0.3)" }}>
                    <Image
                      src="/assets/zoiro-logo.png"
                      alt="ZOIRO Broast"
                      width={100}
                      height={100}
                      className="relative z-10 drop-shadow-xl"
                    />
                  </div>
                )}
              </motion.div>

              {/* Animated Brand Name */}
              <motion.div
                initial={{ opacity: 0, y: shouldReduce ? 10 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduce ? 0.3 : 0.8, delay: shouldReduce ? 0.1 : 0.3 }}
                className="mb-6"
              >
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-bebas tracking-wider">
                  {!shouldReduce ? (
                    <>
                      <motion.span
                        className="inline-block text-transparent bg-clip-text"
                        style={{
                          backgroundImage: "linear-gradient(90deg, #ef4444, #f97316, #fbbf24, #ef4444)",
                          backgroundSize: "300% 100%",
                        }}
                        animate={{
                          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      >
                        ZOIRO
                      </motion.span>
                      {" "}
                      <motion.span
                        className="inline-block text-transparent bg-clip-text"
                        style={{
                          backgroundImage: "linear-gradient(90deg, #fbbf24, #ef4444, #f97316, #fbbf24)",
                          backgroundSize: "300% 100%",
                        }}
                        animate={{
                          backgroundPosition: ["100% 50%", "0% 50%", "100% 50%"],
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                      >
                        BROAST
                      </motion.span>
                    </>
                  ) : (
                    <>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                        ZOIRO
                      </span>
                      {" "}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-500">
                        BROAST
                      </span>
                    </>
                  )}
                </h2>
                <p className="text-zinc-500 text-sm mt-2 tracking-[0.3em] uppercase">
                  Premium Fried Chicken
                </p>
              </motion.div>

              {/* Main Heading */}
              <motion.h1
                initial={{ opacity: 0, y: shouldReduce ? 15 : 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduce ? 0.3 : 0.8, delay: shouldReduce ? 0.15 : 0.2 }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bebas mb-6 leading-none"
              >
                Unlock{" "}
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-amber-400">
                    Premium
                  </span>
                  {!shouldReduce && (
                    <motion.span
                      className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-400 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.8, delay: 0.8 }}
                    />
                  )}
                </span>
                <br />
                Benefits
              </motion.h1>

              {/* Subheading */}
              <motion.p
                initial={{ opacity: 0, y: shouldReduce ? 10 : 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduce ? 0.3 : 0.8, delay: shouldReduce ? 0.2 : 0.4 }}
                className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-12"
              >
                Join thousands of food lovers who save more, eat better, 
                and enjoy exclusive perks as ZOIRO members.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: shouldReduce ? 10 : 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduce ? 0.3 : 0.8, delay: shouldReduce ? 0.25 : 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link href="/auth">
                  <Button 
                    size="lg" 
                    className="h-16 px-10 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-red-500/30 transition-all hover:scale-105 group"
                  >
                    Create Free Account
                    {!shouldReduce ? (
                      <motion.div
                        className="ml-2"
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <ArrowRight className="w-5 h-5 ml-2" />
                    )}
                  </Button>
                </Link>
                <Link href="/menu">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="h-16 px-10 border-2 border-zinc-600 bg-zinc-900/80 hover:bg-zinc-800 hover:border-zinc-500 text-white font-bold text-lg rounded-2xl transition-all hover:scale-105"
                  >
                    <span className="text-white">Browse Menu First</span>
                  </Button>
                </Link>
              </motion.div>

              {/* Scroll indicator - hide on low-end devices */}
              {!shouldReduce && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="absolute bottom-10 left-1/2 -translate-x-1/2"
                >
                  <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-8 h-14 rounded-full border-2 border-zinc-600 flex items-start justify-center p-2"
                  >
                    <motion.div
                      animate={{ y: [0, 16, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2 h-2 bg-red-500 rounded-full"
                    />
                  </motion.div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.section>

        {/* Stats Section */}
        <section className="relative py-20 bg-gradient-to-b from-zinc-950 to-zinc-900">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {STATS.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: shouldReduce ? 15 : 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: shouldReduce ? index * 0.05 : index * 0.1, duration: shouldReduce ? 0.3 : 0.5 }}
                  className="text-center"
                >
                  <div className="text-4xl md:text-5xl font-bebas text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400 mb-2">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-zinc-500 font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="relative py-24">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: shouldReduce ? 15 : 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: shouldReduce ? 0.3 : 0.5 }}
              className="text-center mb-16"
            >
              <span className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-5 py-2 mb-6">
                <Award className="w-4 h-4 text-red-500" />
                <span className="text-red-400 font-semibold">Member Benefits</span>
              </span>
              <h2 className="text-4xl md:text-5xl font-bebas mb-4">
                Why Become a <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">Member?</span>
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Enjoy exclusive perks, earn rewards, and unlock a world of delicious savings
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {MEMBER_BENEFITS.map((benefit, index) => (
                <Feature3DCard
                  key={benefit.title}
                  icon={benefit.icon}
                  title={benefit.title}
                  description={benefit.description}
                  gradient={benefit.gradient}
                  delay={index * 0.1}
                  enableEffects={!shouldReduce}
                />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="relative py-24 bg-zinc-900/50">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <span className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-5 py-2 mb-6">
                <Zap className="w-4 h-4 text-green-500" />
                <span className="text-green-400 font-semibold">Quick & Easy</span>
              </span>
              <h2 className="text-4xl md:text-5xl font-bebas mb-4">
                Get Started in <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">3 Simple Steps</span>
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Create Account",
                  description: "Sign up for free in seconds using your email or phone number",
                  icon: Users,
                },
                {
                  step: "02",
                  title: "Start Ordering",
                  description: "Browse our menu and place your first order to start earning points",
                  icon: ChefHat,
                },
                {
                  step: "03",
                  title: "Enjoy Benefits",
                  description: "Redeem points, unlock deals, and enjoy member-exclusive perks",
                  icon: Heart,
                },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  className="relative"
                >
                  {/* Connection line */}
                  {index < 2 && (
                    <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-zinc-700 to-transparent" />
                  )}
                  
                  <div className="relative bg-zinc-800/50 rounded-3xl p-8 border border-zinc-700/50 text-center">
                    {/* Step number */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold px-4 py-1 rounded-full text-sm">
                      Step {item.step}
                    </div>
                    
                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-xl font-bebas mb-3">{item.title}</h3>
                    <p className="text-zinc-400">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial / Social Proof */}
        <section className="relative py-24">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, scale: shouldReduce ? 0.98 : 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: shouldReduce ? 0.3 : 0.5 }}
              className="relative max-w-4xl mx-auto bg-gradient-to-br from-red-500/10 via-zinc-900 to-orange-500/10 rounded-[3rem] p-12 border border-zinc-800 overflow-hidden"
            >
              {/* Decorative elements - static on low-end devices */}
              {!shouldReduce ? (
                <motion.div
                  className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-500/20 to-transparent rounded-full blur-3xl"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 5, repeat: Infinity }}
                />
              ) : (
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-red-500/15 to-transparent rounded-full blur-2xl" />
              )}
              
              <div className="relative z-10 text-center">
                <div className="flex justify-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: shouldReduce ? i * 0.05 : i * 0.1 }}
                    >
                      <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
                    </motion.div>
                  ))}
                </div>
                
                <blockquote className="text-2xl md:text-3xl font-medium text-white mb-8 leading-relaxed">
                  "Since becoming a ZOIRO member, I've saved over{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">
                    Rs. 5,000
                  </span>{" "}
                  in just 3 months! The birthday reward was the cherry on top."
                </blockquote>
                
                <div className="flex items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                    AA
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white">Ahmed Ali</p>
                    <p className="text-zinc-400 text-sm">Member since 2024</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative py-24 bg-gradient-to-b from-zinc-900 to-zinc-950">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: shouldReduce ? 15 : 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: shouldReduce ? 0.3 : 0.5 }}
              className="text-center max-w-3xl mx-auto"
            >
              {!shouldReduce ? (
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-block mb-6"
                >
                  <Crown className="w-16 h-16 text-amber-400" />
                </motion.div>
              ) : (
                <div className="inline-block mb-6">
                  <Crown className="w-14 h-14 text-amber-400" />
                </div>
              )}
              
              <h2 className="text-4xl md:text-6xl font-bebas mb-6">
                Ready to Join the{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">
                  ZOIRO Family?
                </span>
              </h2>
              
              <p className="text-xl text-zinc-400 mb-10">
                Create your free account now and start enjoying exclusive benefits today!
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth">
                  <Button 
                    size="lg" 
                    className="h-16 px-12 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-red-500/30 transition-all hover:scale-105 group"
                  >
                    Get Started — It's Free
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-zinc-500 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>No Credit Card Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Instant Account Activation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Cancel Anytime</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
  );
}
