"use client";

import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Star, Sparkles, ChefHat, Timer, Flame, Utensils, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect } from "react";
import { isMobile, prefersReducedMotion } from "@/lib/utils";

// 4K Unsplash images - fried chicken and fast food theme
const heroBroast = "https://images.unsplash.com/photo-1562967914-608f82629710?w=1920&h=1080&fit=crop&q=80";
const chickenPiece = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80";
const chickenBurger = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=600&fit=crop&q=80";
const fries = "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=600&fit=crop&q=80";
const wings = "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&h=600&fit=crop&q=80";
const drink = "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=600&h=600&fit=crop&q=80";

// Pre-computed sparkle positions to avoid hydration mismatch
const SPARKLE_RIGHT_POSITIONS = [
  { top: 25, right: 18, duration: 2.3 },
  { top: 42, right: 8, duration: 2.7 },
  { top: 58, right: 22, duration: 2.1 },
  { top: 35, right: 12, duration: 2.9 },
  { top: 70, right: 25, duration: 2.4 },
  { top: 48, right: 5, duration: 2.6 },
  { top: 62, right: 28, duration: 2.2 },
  { top: 30, right: 15, duration: 2.8 },
];

const SPARKLE_LEFT_POSITIONS = [
  { top: 28, left: 5 },
  { top: 45, left: 12 },
  { top: 65, left: 8 },
  { top: 38, left: 3 },
  { top: 55, left: 14 },
];

// Text animation variants
const letterVariants = {
  hidden: { opacity: 0, y: 50, rotateX: -90 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.5,
      ease: [0.6, -0.05, 0.01, 0.99],
    },
  }),
};

const floatingBadgeVariants = {
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 15 }
  },
  hover: { scale: 1.1, rotate: 5 }
};

export default function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentWord, setCurrentWord] = useState(0);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const words = ["SAUCY", "JUICY", "CRISPY"];
  const punchline = "Saucy. Juicy. Crispy.";

  // Mouse tracking for 3D effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    setIsLoaded(true);
    setIsMobileDevice(isMobile());
    setReduceMotion(prefersReducedMotion());
    
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length);
    }, 2500);
    
    const handleResize = () => {
      setIsMobileDevice(isMobile());
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (isMobileDevice) return; // Skip mouse tracking on mobile
    
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set((clientX - innerWidth / 2) / 50);
      mouseY.set((clientY - innerHeight / 2) / 50);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isMobileDevice]);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Parallax transforms - only for background, not floating items
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image with Parallax */}
      <motion.div 
        className="absolute inset-0 z-0 bg-zinc-900"
        style={{ y: bgY, scale: bgScale }}
      >
        <img
          src={heroBroast}
          alt="ZOIRO Injected Broast - Saucy Juicy Crispy"
          className="w-full h-full object-cover object-center opacity-70"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        {/* Darker gradient on left for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/85 to-foreground/70" />
        {/* Bottom gradient for smooth transition */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
      </motion.div>

      {/* Parallax Decorative Layers */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Floating Food Elements with Parallax - Simplified on mobile */}
      <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
        
        {/* ===== LEFT SIDE FLOATING ITEMS ===== */}
        
        {/* Burger - Top Left Corner */}
        <motion.div
          className="absolute top-24 left-[3%] hidden lg:block"
          initial={{ opacity: 0, x: -100, scale: 0.5 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: isMobileDevice ? 0.3 : 1, delay: 0.6, type: "spring" }}
        >
          <motion.img
            src={chickenBurger}
            alt=""
            className="w-28 xl:w-36 drop-shadow-2xl"
            animate={!isMobileDevice && !reduceMotion ? { 
              y: [0, -15, 0],
              rotate: [-5, 5, -5]
            } : {}}
            transition={!isMobileDevice && !reduceMotion ? { 
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" }
            } : {}}
          />
          {/* Glow Effect */}
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl -z-10 scale-150" />
        </motion.div>

        {/* Fries - Left Middle */}
        <motion.div
          className="absolute top-1/2 left-[2%] -translate-y-1/2 hidden md:block"
          initial={{ opacity: 0, x: -80, rotate: -20 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: isMobileDevice ? 0.3 : 0.8, delay: 0.8 }}
        >
          <motion.img
            src={fries}
            alt=""
            className="w-20 lg:w-28 xl:w-32 drop-shadow-2xl"
            animate={!isMobileDevice && !reduceMotion ? { 
              rotate: [-10, 10, -10],
              scale: [1, 1.05, 1]
            } : {}}
            transition={!isMobileDevice && !reduceMotion ? { 
              rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
            } : {}}
          />
        </motion.div>

        {/* Drink - Bottom Left Corner */}
        <motion.div
          className="absolute bottom-24 left-[5%] hidden lg:block"
          initial={{ opacity: 0, y: 50, scale: 0.5 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <motion.img
            src={drink}
            alt=""
            className="w-20 xl:w-28 drop-shadow-2xl"
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 5, 0]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>

        {/* ===== RIGHT SIDE FLOATING ITEMS ===== */}
        
        {/* Main Chicken Piece - Top Right */}
        <motion.div
          className="absolute top-16 sm:top-20 right-[8%] sm:right-[10%]"
        >
          <motion.img
            src={chickenPiece}
            alt=""
            className="w-28 sm:w-40 lg:w-52 xl:w-64 drop-shadow-2xl"
            initial={{ opacity: 0, y: -50, rotate: -15, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              y: [0, -20, 0], 
              rotate: [-15, -5, -15],
              scale: 1
            }}
            transition={{ 
              opacity: { duration: 0.8, delay: 0.5 },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 0.8, delay: 0.5 }
            }}
          />
          {/* Animated ring around main chicken */}
          <motion.div
            className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-full scale-150"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>

        {/* Wings - Right Middle */}
        <motion.img
          src={wings}
          alt=""
          className="absolute top-[35%] right-[3%] sm:right-[5%] w-24 sm:w-32 lg:w-44 xl:w-52 drop-shadow-2xl"
          initial={{ opacity: 0, x: 50, rotate: 10 }}
          animate={{ 
            opacity: 1, 
            x: [0, -15, 0],
            rotate: [10, -5, 10]
          }}
          transition={{ 
            opacity: { duration: 0.8, delay: 0.7 },
            x: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" }
          }}
        />

        {/* Fries - Bottom Right */}
        <motion.img
          src={fries}
          alt=""
          className="absolute bottom-28 sm:bottom-32 right-[12%] sm:right-[15%] w-20 sm:w-28 lg:w-36 drop-shadow-2xl"
          initial={{ opacity: 0, y: 50, rotate: 5 }}
          animate={{ 
            opacity: 1, 
            rotate: [5, -5, 5],
            y: [0, -10, 0]
          }}
          transition={{ 
            opacity: { duration: 0.8, delay: 0.9 },
            rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
          }}
        />

        {/* Drink - Far Right */}
        <motion.img
          src={drink}
          alt=""
          className="absolute bottom-[20%] right-[1%] sm:right-[2%] w-16 sm:w-24 lg:w-32 drop-shadow-2xl hidden sm:block"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: 1, 
            scale: [1, 1.08, 1],
            y: [0, -8, 0]
          }}
          transition={{ 
            opacity: { duration: 0.8, delay: 1.1 },
            scale: { duration: 5, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
        />

        {/* Extra Burger - Bottom Right */}
        <motion.div
          className="absolute bottom-16 right-[25%] hidden xl:block"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.8, scale: 1 }}
          transition={{ duration: 0.8, delay: 1.3 }}
        >
          <motion.img
            src={chickenBurger}
            alt=""
            className="w-24 drop-shadow-xl opacity-80"
            animate={{ 
              rotate: [0, -10, 0],
              y: [0, 10, 0]
            }}
            transition={{ 
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>

        {/* ===== SPARKLE & PARTICLE EFFECTS ===== */}
        
        {/* Primary Sparkles - Right Side */}
        {SPARKLE_RIGHT_POSITIONS.map((pos, i) => (
          <motion.div
            key={`sparkle-right-${i}`}
            className="absolute w-1.5 sm:w-2 h-1.5 sm:h-2 bg-primary rounded-full"
            style={{
              top: `${pos.top}%`,
              right: `${pos.right}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 1, 0], 
              scale: [0, 1.5, 0] 
            }}
            transition={{ 
              duration: pos.duration,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Secondary Sparkles - Left Side */}
        {SPARKLE_LEFT_POSITIONS.map((pos, i) => (
          <motion.div
            key={`sparkle-left-${i}`}
            className="absolute w-1 sm:w-1.5 h-1 sm:h-1.5 bg-accent rounded-full hidden lg:block"
            style={{
              top: `${pos.top}%`,
              left: `${pos.left}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 0.8, 0], 
              scale: [0, 1.2, 0] 
            }}
            transition={{ 
              duration: 2.5,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Floating Circles/Orbs */}
        <motion.div
          className="absolute top-1/4 right-1/4 w-4 h-4 bg-primary/30 rounded-full blur-sm hidden md:block"
          animate={{ 
            y: [0, -30, 0],
            x: [0, 15, 0],
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/3 right-1/3 w-3 h-3 bg-accent/40 rounded-full blur-sm hidden md:block"
          animate={{ 
            y: [0, 20, 0],
            x: [0, -10, 0],
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.7, 0.4]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/3 left-[10%] w-3 h-3 bg-primary/20 rounded-full blur-sm hidden lg:block"
          animate={{ 
            y: [0, -20, 0],
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.5, 0.2]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
      </div>

      {/* Content with Parallax */}
      <motion.div 
        className="container-custom relative z-10 pt-16 sm:pt-20 lg:pt-24"
        style={{ y: contentY, opacity: contentOpacity, x: smoothMouseX, rotateY: smoothMouseX }}
      >
        <div className="max-w-2xl px-2 sm:px-0">
          {/* Animated Badge */}
          <motion.div
            variants={floatingBadgeVariants}
            initial="initial"
            animate="animate"
            whileHover="hover"
            className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-4 sm:mb-6 cursor-pointer"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Star className="h-3 w-3 sm:h-4 sm:w-4 text-accent fill-accent" />
            </motion.div>
            <span className="text-primary-foreground text-xs sm:text-sm font-medium">
              #1 Broast in Vehari City
            </span>
            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-accent animate-pulse" />
          </motion.div>

          {/* Logo and Brand Section */}
          <div className="flex items-center gap-4 mb-4 sm:mb-6">
            <motion.div
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 200, 
                damping: 15,
                delay: 0.2 
              }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="relative"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
                <img 
                  src="/assets/zoiro-logo.png" 
                  alt="ZOIRO Broast Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Animated ring around logo */}
              <motion.div
                className="absolute -inset-2 border-2 border-dashed border-primary/40 rounded-3xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          </div>

          {/* Animated Heading with Letter-by-Letter Animation */}
          <div className="overflow-hidden mb-2 sm:mb-4">
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bebas text-primary-foreground leading-[0.9] sm:leading-tight"
            >
              <motion.span 
                className="text-primary inline-block"
                initial={{ opacity: 0, x: -100, rotateY: -90 }}
                animate={{ 
                  opacity: 1, 
                  x: 0, 
                  rotateY: 0
                }}
                transition={{ 
                  duration: 0.8, 
                  ease: [0.6, -0.05, 0.01, 0.99]
                }}
              >
                ZOIRO
              </motion.span>
              <br />
              <motion.span
                className="inline-block text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                INJECTED BROAST
              </motion.span>
            </motion.h1>
          </div>

          {/* Animated Punchline - Saucy. Juicy. Crispy. - LOOPED APPEAR ANIMATION */}
          <motion.div
            className="mb-4 sm:mb-6 overflow-hidden relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {["Saucy", "Juicy", "Crispy"].map((word, index) => (
                <motion.span
                  key={word}
                  className={`punch-word punch-word-${word.toLowerCase()} text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl`}
                  initial={{ opacity: 0, y: 30, scale: 0.5 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0],
                    y: [30, 0, 0, -20],
                    scale: [0.5, 1, 1, 0.8],
                  }}
                  transition={{ 
                    duration: 3,
                    delay: index * 1,
                    repeat: Infinity,
                    repeatDelay: 6,
                    times: [0, 0.15, 0.85, 1],
                    ease: "easeInOut"
                  }}
                >
                  {word}<span className="punch-dot">.</span>
                </motion.span>
              ))}
            </div>
            
            {/* Animated underline */}
            <motion.div
              className="h-1 sm:h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 rounded-full mt-3"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
              style={{ maxWidth: "350px" }}
            />
          </motion.div>

          {/* Subtitle with Staggered Animation */}
          <motion.p
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-sm sm:text-base md:text-lg lg:text-xl text-primary-foreground/80 mb-6 sm:mb-8 max-w-lg leading-relaxed"
          >
            Experience the perfect crunch. Our signature broast is marinated with
            secret spices and cooked to golden perfection. 
            <motion.span 
              className="text-primary font-semibold"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {" "}Taste the difference.
            </motion.span>
          </motion.p>

          {/* CTA Buttons with Enhanced Animation */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4"
          >
            <Link href="/menu" className="w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative overflow-hidden"
              >
                <Button className="btn-zoiro w-full sm:w-auto group relative overflow-hidden">
                  <motion.span
                    className="absolute inset-0 bg-white/20"
                    initial={{ x: "-100%", skewX: -15 }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5 }}
                  />
                  <Flame className="h-4 w-4 sm:h-5 sm:w-5 mr-1 animate-pulse" />
                  Order Now
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-2" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/menu" className="w-full sm:w-auto">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 font-semibold text-lg rounded-full transition-all duration-300 bg-transparent border-2 border-white text-white hover:bg-white hover:text-foreground">
                  <ChefHat className="h-4 w-4 sm:h-5 sm:w-5 mr-1" />
                  View Menu
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          {/* Enhanced Stats with Counter Animation */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="grid grid-cols-3 gap-4 sm:gap-8 mt-8 sm:mt-12"
          >
            {[
              { value: "5000+", label: "Happy Customers", icon: "😊" },
              { value: "4.9", label: "Average Rating", icon: "⭐" },
              { value: "30 min", label: "Fast Delivery", icon: "🚀" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                className="text-center sm:text-left group cursor-pointer"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1, type: "spring" }}
                whileHover={{ scale: 1.1, y: -5 }}
              >
                <motion.p 
                  className="text-xl sm:text-2xl md:text-3xl font-bebas text-primary flex items-center justify-center sm:justify-start gap-1"
                  animate={{ textShadow: ["0 0 0px hsl(var(--primary))", "0 0 20px hsl(var(--primary))", "0 0 0px hsl(var(--primary))"] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                >
                  <span className="text-lg sm:text-xl">{stat.icon}</span>
                  {stat.value}
                </motion.p>
                <p className="text-[10px] sm:text-xs md:text-sm text-primary-foreground/70 group-hover:text-primary-foreground transition-colors">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Quick Features Row - Mobile optimized */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex flex-wrap gap-2 sm:gap-4 mt-6 sm:mt-8"
          >
            {[
              { icon: Timer, text: "Fresh Made" },
              { icon: Flame, text: "Hot & Spicy" },
              { icon: ChefHat, text: "Chef's Special" },
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-1 sm:gap-2 bg-white/10 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1 sm:py-1.5"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + index * 0.1 }}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <feature.icon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                <span className="text-[10px] sm:text-xs text-primary-foreground/80">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* ===== ADVANCED CORNER DECORATIONS ===== */}
      
      {/* Top Left Corner */}
      <motion.div
        className="absolute top-16 left-4 hidden md:block"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <div className="relative">
          <div className="w-24 h-24 lg:w-32 lg:h-32 border-l-2 border-t-2 border-primary/40" />
          <motion.div
            className="absolute top-0 left-0 w-3 h-3 bg-primary rounded-full"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>

      {/* Top Right Corner */}
      <motion.div
        className="absolute top-16 right-4 hidden lg:block"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.1, duration: 0.5 }}
      >
        <div className="relative">
          <div className="w-24 h-24 border-r-2 border-t-2 border-accent/30" />
          <motion.div
            className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          />
        </div>
      </motion.div>

      {/* Bottom Left Corner */}
      <motion.div
        className="absolute bottom-16 left-4 hidden lg:block"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <div className="relative">
          <div className="w-20 h-20 border-l-2 border-b-2 border-accent/30" />
          <motion.div
            className="absolute bottom-0 left-0 w-2 h-2 bg-accent rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          />
        </div>
      </motion.div>

      {/* Bottom Right Corner */}
      <motion.div
        className="absolute bottom-16 right-4 hidden md:block"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.3, duration: 0.5 }}
      >
        <div className="relative">
          <div className="w-28 h-28 lg:w-36 lg:h-36 border-r-2 border-b-2 border-primary/40" />
          <motion.div
            className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
          />
        </div>
      </motion.div>

      {/* ===== ANIMATED LINES ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[2] hidden lg:block" preserveAspectRatio="none">
        <motion.line
          x1="0" y1="20%" x2="15%" y2="20%"
          stroke="hsl(var(--primary))"
          strokeWidth="1"
          strokeOpacity="0.3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 1 }}
        />
        <motion.line
          x1="85%" y1="80%" x2="100%" y2="80%"
          stroke="hsl(var(--primary))"
          strokeWidth="1"
          strokeOpacity="0.3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 1.2 }}
        />
      </svg>

      {/* ===== FLOATING AWARD BADGE ===== */}
      <motion.div
        className="absolute top-28 left-8 hidden xl:flex items-center gap-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-full px-4 py-2 z-[6]"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring" }}
        whileHover={{ scale: 1.05 }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Award className="h-6 w-6 text-accent" />
        </motion.div>
        <div>
          <p className="text-white text-xs font-semibold">Premium Quality</p>
          <p className="text-white/60 text-[10px]">Since 2020</p>
        </div>
      </motion.div>

      {/* ===== ROTATING CIRCLE DECORATION ===== */}
      <motion.div
        className="absolute top-1/4 left-[8%] w-32 h-32 hidden xl:block pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <div className="w-full h-full border border-dashed border-white/10 rounded-full" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary/50 rounded-full" />
      </motion.div>

      {/* ===== PULSING GLOW EFFECTS ===== */}
      <motion.div
        className="absolute top-1/3 left-[5%] w-40 h-40 bg-primary/10 rounded-full blur-3xl hidden lg:block"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-[30%] w-60 h-60 bg-accent/5 rounded-full blur-3xl hidden lg:block"
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* ===== FOOD ICON TRAIL - Left Side ===== */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-6 z-[6]">
        {["🍗", "🍔", "🍟", "🥤"].map((emoji, index) => (
          <motion.div
            key={index}
            className="w-10 h-10 bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center text-lg border border-white/10"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.5 + index * 0.15 }}
            whileHover={{ scale: 1.2, backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <motion.span
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
            >
              {emoji}
            </motion.span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
