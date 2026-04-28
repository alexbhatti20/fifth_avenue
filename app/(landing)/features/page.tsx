"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence, useSpring } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { 
  Sparkles, Star, Crown, Gift, Percent, Truck, Clock, Shield, 
  ChefHat, Heart, Bell, Zap, Award, Users, TrendingUp, 
  ArrowRight, Check, Play, Pause, Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePerformanceMode } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

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
          color: Math.random() > 0.5 ? "rgba(0, 0, 0, 0.3)" : "rgba(237, 28, 36, 0.2)",
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
  delay = 0,
  enableEffects = true,
}: {
  icon: any;
  title: string;
  description: string;
  gradient?: string;
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
    
    setRotateX((y - centerY) / 20);
    setRotateY((centerX - x) / 20);
  }, [enableEffects]);

  const handleMouseLeave = useCallback(() => {
    setRotateX(0);
    setRotateY(0);
  }, []);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative group cursor-pointer"
      style={{
        transform: enableEffects ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)` : "none",
        transformStyle: "preserve-3d",
        transition: "transform 0.1s ease-out",
      }}
    >
      <div className="relative p-8 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-none group-hover:translate-x-[4px] group-hover:translate-y-[4px] transition-all overflow-hidden h-full">
        {/* Decorative background number or icon */}
        <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Icon className="w-32 h-32 text-black" />
        </div>
        
        {/* Icon */}
        <div className="w-16 h-16 bg-black border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(255,210,0,1)]">
          <Icon className="w-8 h-8 text-[#FFD200]" />
        </div>
        
        <h3 className="text-3xl font-bebas text-black mb-3">
          {title}
        </h3>
        <p className="font-source-sans font-bold text-black/60 leading-tight">
          {description}
        </p>

        {/* Hover Arrow */}
        <div className="mt-6 flex items-center gap-2 text-black group-hover:text-[#ED1C24] transition-colors">
          <span className="font-bebas text-lg">STREET INTEL</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Performance detection
  const { shouldReduce, canUseWebGL, canUseParallax, performanceLevel } = usePerformanceMode();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const y = useSpring(useTransform(scrollYProgress, [0, 0.2], [0, 200]), springConfig);
  const scale = useSpring(useTransform(scrollYProgress, [0, 0.2], [1, 1.1]), springConfig);

  useEffect(() => {
    if (shouldReduce) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 15,
        y: (e.clientY / window.innerHeight - 0.5) * 15,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [shouldReduce]);

  return (
    <div className="min-h-screen bg-white text-black overflow-hidden relative" ref={containerRef}>
        {/* WebGL Background - Optimized for light theme if needed, or kept for effect */}
        <WebGLBackground enabled={canUseWebGL} />

        {/* Hero Section - Urban Street Redesign */}
        <section className="relative min-h-[100vh] lg:min-h-[110vh] flex flex-col items-center justify-center overflow-hidden bg-[#FFD200] pt-20">
          
          {/* Decorative Texture */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          
          {/* The Vertical "Road" Strap */}
          {!shouldReduce && (
            <motion.div
              style={{ y }}
              className="absolute top-[-50vh] bottom-[-50vh] left-1/2 -translate-x-1/2 w-48 md:w-64 lg:w-96 bg-black z-0 shadow-2xl hidden md:block"
            />
          )}

          <div className="container mx-auto px-6 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">
              
              {/* Main Visual Core - Kinetic Logo Disc */}
              <div className="relative order-1 lg:order-2">
                <motion.div
                  style={!shouldReduce ? { scale, x: mousePos.x, y: mousePos.y } : {}}
                  className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 lg:w-[500px] lg:h-[500px]"
                >
                  {/* Outer Rings */}
                  {!shouldReduce && (
                    <>
                      <div className="absolute inset-[-15px] border-[8px] border-black rounded-full z-0" />
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-[-30px] border-2 border-dashed border-black/40 rounded-full"
                      />
                    </>
                  )}

                  <div className="relative w-full h-full rounded-full border-[15px] lg:border-[25px] border-black shadow-2xl overflow-hidden bg-white flex items-center justify-center p-8">
                    <Image
                      src="/assets/logo.png"
                      alt="Fifth Avenue Squad"
                      width={400}
                      height={400}
                      priority
                      className="object-contain"
                    />
                  </div>

                  {/* Spinning Badge */}
                  {!shouldReduce && (
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                      className="absolute -top-6 -right-6 w-32 h-32 lg:w-44 lg:h-44 bg-[#ED1C24] rounded-full border-4 border-black flex items-center justify-center p-4 shadow-xl"
                    >
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <path id="badgePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="none" />
                        <text className="font-bebas text-[11px] lg:text-[13px] uppercase tracking-[0.15em] fill-white">
                          <textPath xlinkHref="#badgePath">
                            • JOIN THE SQUAD • MEMBER PERKS • ELITE TIER •
                          </textPath>
                        </text>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Crown className="w-8 h-8 lg:w-12 lg:h-12 text-white fill-white" />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Typography Content */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1 max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-black text-[#FFD200] px-6 py-2 font-bebas text-xl lg:text-2xl mb-8 border-l-8 border-[#ED1C24] inline-block shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
                >
                  ELITE MEMBERSHIP HUB
                </motion.div>

                <div className="relative mb-12">
                  <h1 className="font-bebas text-7xl sm:text-8xl lg:text-[10rem] leading-[0.8] text-black tracking-tight uppercase">
                    MEMBER <br />
                    <span className="text-white drop-shadow-[6px_6px_0px_rgba(0,0,0,1)] lg:drop-shadow-[10px_10px_0px_rgba(0,0,0,1)]">FEATURES</span>
                  </h1>
                  <motion.span
                    initial={{ opacity: 0, rotate: 15 }}
                    animate={{ opacity: 1, rotate: -5 }}
                    className="font-caveat text-4xl sm:text-5xl lg:text-7xl text-[#ED1C24] absolute -bottom-10 -right-4 lg:-right-24 whitespace-nowrap drop-shadow-md z-20"
                  >
                    The Elite Squad
                  </motion.span>
                </div>

                <p className="font-source-sans text-xl lg:text-2xl font-black text-black/80 mb-12 max-w-lg leading-tight border-l-4 border-black pl-6 uppercase tracking-tighter">
                  Unlock the full Fifth Avenue experience. More flavor, less wait, bigger respect.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-6 w-full">
                  <Link href="/auth" className="w-full sm:w-auto">
                    <Button className="w-full h-20 px-12 bg-black text-white rounded-none font-bebas text-3xl tracking-widest hover:bg-[#ED1C24] transition-all border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] group">
                      JOIN THE SQUAD
                      <ArrowRight className="ml-4 w-8 h-8 group-hover:translate-x-2 transition-transform" />
                    </Button>
                  </Link>
                  <div className="flex flex-col">
                    <span className="font-bebas text-sm text-black/40 tracking-widest">STREET HOTLINE</span>
                    <span className="font-bebas text-2xl text-black">0304-1116617</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:block">
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex flex-col items-center gap-2"
            >
              <span className="font-bebas text-black/40 text-sm tracking-widest uppercase">SCROLL FOR INTEL</span>
              <div className="w-px h-16 bg-black/20 relative">
                <motion.div 
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-[#ED1C24] rounded-full"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section - Street Style */}
        <section className="relative py-24 bg-white border-y-8 border-black">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {STATS.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: shouldReduce ? 15 : 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: shouldReduce ? index * 0.05 : index * 0.1 }}
                  className="text-center group"
                >
                  <div className="text-5xl md:text-7xl font-bebas text-black mb-2 group-hover:text-[#ED1C24] transition-colors">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="font-bebas text-xl text-black/40 tracking-widest uppercase">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Grid - Street Style */}
        <section className="relative py-32 bg-[#f4f4f4]">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-24"
            >
              <div className="bg-black text-[#FFD200] px-6 py-2 inline-block mb-6 shadow-[4px_4px_0px_0px_rgba(237,28,36,1)]">
                <span className="font-bebas text-2xl tracking-widest uppercase">THE SQUAD PERKS</span>
              </div>
              <h2 className="text-6xl md:text-8xl font-bebas text-black mb-6 leading-none">
                WHY JOIN THE <span className="text-[#ED1C24] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">ELITE?</span>
              </h2>
              <p className="font-source-sans text-xl font-bold text-black/60 max-w-2xl mx-auto uppercase tracking-tighter">
                Exclusive respect, street-fast delivery, and flavor deals you can't find anywhere else.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {MEMBER_BENEFITS.map((benefit, index) => (
                <Feature3DCard
                  key={benefit.title}
                  icon={benefit.icon}
                  title={benefit.title}
                  description={benefit.description}
                  delay={index * 0.1}
                  enableEffects={!shouldReduce}
                />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - Street Style */}
        <section className="relative py-32 bg-black text-white">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-24"
            >
              <h2 className="text-6xl md:text-8xl font-bebas mb-6 leading-none text-[#FFD200]">
                THE STREET <span className="text-white">PROTOCOL</span>
              </h2>
              <p className="font-caveat text-3xl text-[#ED1C24]">Ready in 3 simple moves.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
              {[
                {
                  step: "01",
                  title: "DROP YOUR INFO",
                  description: "Sign up for free in seconds. We just need the basics to get you in the squad.",
                  icon: Users,
                },
                {
                  step: "02",
                  title: "CLAIM THE FLAVOR",
                  description: "Place your orders through the hub. Every bite earns you street respect.",
                  icon: ChefHat,
                },
                {
                  step: "03",
                  title: "REAP THE REWARDS",
                  description: "Unlock VIP deals, priority prepares, and exclusive birthday drops.",
                  icon: Heart,
                },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  className="relative group"
                >
                  <div className="relative bg-[#111111] border-4 border-white p-10 h-full shadow-[10px_10px_0px_0px_rgba(255,210,0,1)] group-hover:shadow-none group-hover:translate-x-[4px] group-hover:translate-y-[4px] transition-all">
                    <div className="absolute -top-6 left-6 bg-[#ED1C24] text-white font-bebas text-2xl px-4 py-1 border-2 border-white transform rotate-[-2deg]">
                      STEP {item.step}
                    </div>
                    
                    <div className="w-20 h-20 bg-white flex items-center justify-center mb-8 border-4 border-[#FFD200] transform group-hover:rotate-12 transition-transform">
                      <item.icon className="w-10 h-10 text-black" strokeWidth={2.5} />
                    </div>
                    
                    <h3 className="text-3xl font-bebas mb-4 text-[#FFD200] tracking-widest">{item.title}</h3>
                    <p className="font-source-sans font-bold text-white/60 leading-tight">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial - Street Style */}
        <section className="relative py-32 bg-[#FFD200] border-y-8 border-black">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="max-w-5xl mx-auto bg-white border-8 border-black p-12 md:p-20 shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden"
            >
              {/* Quote Mark Decoration */}
              <div className="absolute top-10 right-10 opacity-5">
                 <Sparkles className="w-64 h-64 text-black" />
              </div>
              
              <div className="relative z-10">
                <div className="flex gap-2 mb-10">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-8 h-8 text-black fill-black" />
                  ))}
                </div>
                
                <blockquote className="font-bebas text-4xl md:text-6xl text-black mb-12 leading-[0.9] tracking-tight uppercase">
                  "SINCE JOINING THE SQUAD, I'VE SAVED OVER{" "}
                  <span className="text-[#ED1C24]">RS. 5,000</span>{" "}
                  IN JUST 3 MONTHS! THE BIRTHDAY DROPS ARE INSANE."
                </blockquote>
                
                <div className="flex items-center gap-6 border-t-4 border-black pt-10">
                  <div className="w-20 h-20 bg-black flex items-center justify-center text-[#FFD200] font-bebas text-4xl shadow-[6px_6px_0px_0px_rgba(237,28,36,1)] transform rotate-3">
                    AA
                  </div>
                  <div>
                    <p className="font-bebas text-3xl text-black leading-none uppercase">Ahmed Ali</p>
                    <p className="font-source-sans font-black text-[#ED1C24] uppercase tracking-widest">SQUAD MEMBER SINCE '24</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Final CTA - Street Style */}
        <section className="relative py-40 bg-white">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-center max-w-4xl mx-auto"
            >
              <div className="bg-[#ED1C24] p-6 border-4 border-black inline-block mb-12 shadow-[10px_10px_0px_0px_rgba(255,210,0,1)] animate-bounce">
                <Crown className="w-20 h-20 text-white" />
              </div>
              
              <h2 className="text-7xl md:text-9xl font-bebas text-black mb-12 leading-[0.8] tracking-tighter uppercase">
                READY TO RUN <br />
                <span className="text-[#ED1C24] drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">WITH THE SQUAD?</span>
              </h2>
              
              <p className="font-source-sans text-2xl font-black text-black/40 mb-16 uppercase tracking-tight">
                CLAIM YOUR ELITE STATUS NOW. NO STRINGS, JUST FLAVOR.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <Link href="/auth" className="w-full sm:w-auto">
                  <Button 
                    className="w-full sm:w-auto h-24 px-16 bg-black text-white rounded-none font-bebas text-4xl tracking-widest hover:bg-[#ED1C24] border-4 border-black shadow-[12px_12px_0px_0px_rgba(255,210,0,1)] group"
                  >
                    START FREE
                    <ArrowRight className="ml-4 w-10 h-10 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </Link>
                <Link href="/menu" className="w-full sm:w-auto">
                   <Button variant="ghost" className="font-bebas text-3xl text-black hover:text-[#ED1C24] uppercase tracking-widest px-10 h-24">
                      SCOPE THE MENU FIRST
                   </Button>
                </Link>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-12 mt-20 text-black/40 font-bebas text-xl tracking-widest">
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6 text-[#ED1C24]" />
                  <span>INSTANT VIBE</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-[#008A45]" />
                  <span>SECURE INTEL</span>
                </div>
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6 text-[#FFD200]" />
                  <span>SQUAD SPEED</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
  );
}
