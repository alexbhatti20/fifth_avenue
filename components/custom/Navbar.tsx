"use client";

import { useState, useEffect, useRef, useMemo, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu, X, ShoppingCart, User, Sparkles, Phone, 
  LogOut, Settings, Package, Heart, Award, CreditCard,
  MapPin, ChevronDown, Bell, History, Flame, Star,
  ArrowRight, Crown, LayoutGrid, Users, ClipboardList
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BlockedCustomerDialog } from "./BlockedCustomerDialog";
import { useReducedMotion, usePerformanceMode } from "@/hooks/useReducedMotion";
import dynamic from "next/dynamic";

// Dynamically import Lottie to avoid SSR issues - with loading placeholder
const Lottie = dynamic(() => import("lottie-react"), { 
  ssr: false,
  loading: () => <div className="w-5 h-5" /> // Placeholder to prevent layout shift
});

// Lazy load chicken animation only when needed
let chickenAnimation: object | null = null;
const loadChickenAnimation = () => {
  if (!chickenAnimation) {
    chickenAnimation = require("@/public/assets/chicken-lottie.json");
  }
  return chickenAnimation;
};

const baseNavLinks = [
  { name: "Home", path: "/", icon: null },
  { name: "Menu", path: "/menu", icon: Flame },
  { name: "Reviews", path: "/reviews", icon: Star },
  { name: "Contact", path: "/contact", icon: Phone },
];

// Premium NavLink component with advanced hover effects
const NavLink = memo(function NavLink({ 
  link, 
  isActive, 
  isScrolled, 
  isHovered,
  onMouseEnter,
  onMouseLeave,
  shouldReduceMotion 
}: { 
  link: { name: string; path: string; icon: any };
  isActive: boolean;
  isScrolled: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  shouldReduceMotion: boolean;
}) {
  const Icon = link.icon;
  
  return (
    <Link
      href={link.path}
      className="relative px-4 py-2.5 group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      prefetch={true}
    >
      {/* Animated background glow */}
      <motion.div
        initial={false}
        animate={{
          opacity: isHovered || isActive ? 1 : 0,
          scale: isHovered || isActive ? 1 : 0.8,
        }}
        transition={{ duration: 0.2 }}
        className={`absolute inset-0 rounded-xl ${
          isScrolled 
            ? "bg-gradient-to-r from-primary/15 via-orange-500/10 to-primary/15" 
            : "bg-white/15 backdrop-blur-sm"
        }`}
      />
      
      {/* Shimmer effect on hover */}
      {isHovered && !shouldReduceMotion && (
        <motion.div
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: "100%", opacity: 0.3 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className={`absolute inset-0 rounded-xl ${
            isScrolled ? "bg-gradient-to-r from-transparent via-primary/30 to-transparent" : "bg-gradient-to-r from-transparent via-white/40 to-transparent"
          }`}
        />
      )}
      
      <span
        className={`relative z-10 font-semibold transition-all duration-300 flex items-center gap-1.5 ${
          isActive
            ? isScrolled ? "text-primary" : "text-white"
            : isScrolled
            ? "text-foreground/80 group-hover:text-primary"
            : "text-white/85 group-hover:text-white"
        }`}
      >
        {Icon && <Icon className={`w-4 h-4 ${isActive ? "text-orange-500" : ""}`} />}
        {link.name}
      </span>
      
      {/* Active indicator - animated underline */}
      <motion.div
        initial={false}
        animate={{
          width: isActive ? "60%" : isHovered ? "40%" : "0%",
          opacity: isActive || isHovered ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full ${
          isScrolled 
            ? "bg-gradient-to-r from-primary via-orange-500 to-primary" 
            : "bg-gradient-to-r from-white/50 via-white to-white/50"
        }`}
      />
    </Link>
  );
});

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHoveredLink, setIsHoveredLink] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [animationLoaded, setAnimationLoaded] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [userType, setUserType] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const { user, signOut, fastSignOut, isBanned, banReason } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const { shouldReduce, performanceLevel } = usePerformanceMode();
  
  // Use more aggressive reduction on mobile - combines system preference with device capability
  const disableAnimations = shouldReduceMotion || shouldReduce;

  // Track hydration to prevent mismatch
  useEffect(() => {
    setHasMounted(true);
    // Get user type from localStorage
    const storedUserType = localStorage.getItem('user_type');
    setUserType(storedUserType);
  }, []);

  // Update user type when user changes (login/logout)
  useEffect(() => {
    if (hasMounted) {
      const storedUserType = localStorage.getItem('user_type');
      setUserType(storedUserType);
    }
  }, [user, hasMounted]);

  // Lazy load animation after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      loadChickenAnimation();
      setAnimationLoaded(true);
    }, 1000); // Delay loading animation
    return () => clearTimeout(timer);
  }, []);

  // Dynamic nav links - show Features only for non-logged-in users
  // Use baseNavLinks during SSR/initial render to prevent hydration mismatch
  const navLinks = useMemo(() => {
    // During SSR and initial render, always use baseNavLinks for consistency
    if (!hasMounted) {
      return baseNavLinks;
    }
    if (user) {
      return baseNavLinks;
    }
    // Insert Features link after Home for non-logged-in users (client-side only)
    return [
      baseNavLinks[0], // Home
      { name: "Features", path: "/features", icon: Star },
      ...baseNavLinks.slice(1), // Menu, Reviews, Contact
    ];
  }, [user, hasMounted]);

  useEffect(() => {
    // Throttled scroll handler for performance
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    setIsUserMenuOpen(false);
    router.push("/");
  };

  // User dropdown menu items - different for employees vs customers
  const userMenuItems = useMemo(() => {
    // Employee/Admin menu items - redirect to portal
    if (userType === 'admin' || userType === 'employee') {
      return [
        { icon: LayoutGrid, label: "Go to Portal", href: "/portal", color: "text-primary" },
        { icon: ClipboardList, label: "Orders", href: "/portal/orders", color: "text-blue-500" },
        { icon: Users, label: "Employees", href: "/portal/employees", color: "text-purple-500" },
        { icon: Settings, label: "Settings", href: "/portal/settings", color: "text-gray-500" },
      ];
    }
    // Customer menu items
    return [
      { icon: Package, label: "My Orders", href: "/orders", color: "text-blue-500" },
      { icon: History, label: "Order History", href: "/orders/history", color: "text-purple-500" },
      { icon: MapPin, label: "Track Order", href: "/orders/track", color: "text-green-500" },
      { icon: Award, label: "Loyalty Points", href: "/loyalty", color: "text-yellow-500" },
      { icon: CreditCard, label: "Payments", href: "/payments", color: "text-emerald-500" },
      { icon: Heart, label: "Favorites", href: "/favorites", color: "text-red-500" },
      { icon: Settings, label: "Settings", href: "/settings", color: "text-gray-500" },
    ];
  }, [userType]);

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] border-b border-white/10 py-1"
          : "bg-gradient-to-r from-primary via-primary/95 to-orange-600 py-0"
      }`}
    >
      {/* Animated gradient border at bottom when scrolled */}
      {isScrolled && (
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      )}
      
      {/* Premium glass effect overlay */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${
        isScrolled ? "opacity-0" : "opacity-100"
      }`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(249,115,22,0.2)_0%,transparent_50%)]" />
      </div>
      
      <nav className="container-custom relative">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo with Premium Image */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              className="flex items-center gap-3"
            >
              {/* Logo Image with glow effect */}
              <motion.div 
                className="relative"
                animate={shouldReduceMotion ? undefined : { rotate: [0, 1, -1, 0] }}
                transition={shouldReduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Glow effect behind logo */}
                <div className={`absolute inset-0 rounded-2xl blur-xl transition-opacity duration-300 ${
                  isScrolled ? "bg-primary/30 opacity-0 group-hover:opacity-100" : "bg-white/20 opacity-50"
                }`} />
                <div className="w-12 h-12 md:w-14 md:h-14 relative rounded-2xl overflow-hidden shadow-xl ring-2 ring-white/20 group-hover:ring-white/40 transition-all duration-300">
                  <Image 
                    src="/assets/zoiro-logo.png" 
                    alt="ZOIRO Injected Broast"
                    fill
                    sizes="56px"
                    className="object-cover"
                    priority
                  />
                </div>
              </motion.div>
              
              {/* Logo Text with enhanced styling */}
              <div className="flex flex-col leading-none">
                <span className={`text-2xl md:text-3xl font-bebas tracking-wider transition-all duration-300 ${
                  isScrolled ? "text-primary" : "text-white drop-shadow-lg"
                }`}>
                  ZOIRO
                </span>
                <span className={`text-[8px] md:text-[10px] font-semibold tracking-[0.25em] uppercase transition-all duration-300 ${
                  isScrolled ? "text-muted-foreground" : "text-white/80"
                }`}>
                  Premium Broast
                </span>
              </div>
            </motion.div>
          </Link>

          {/* Desktop Navigation - Premium Glass Pill Container */}
          <div className="hidden md:flex items-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-2xl transition-all duration-300 ${
                isScrolled 
                  ? "bg-secondary/50 backdrop-blur-sm border border-border/50" 
                  : "bg-white/10 backdrop-blur-md border border-white/20"
              }`}
            >
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  link={link}
                  isActive={pathname === link.path}
                  isScrolled={isScrolled}
                  isHovered={isHoveredLink === link.path}
                  onMouseEnter={() => setIsHoveredLink(link.path)}
                  onMouseLeave={() => setIsHoveredLink(null)}
                  shouldReduceMotion={shouldReduceMotion}
                />
              ))}
            </motion.div>
          </div>

          {/* Right Side Actions - Premium Styling */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Order Now Button - Desktop with premium hover effect */}
            <div className="hidden lg:block">
              <Link href="/menu" prefetch={true}>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative group"
                >
                  {/* Glow effect */}
                  <div className={`absolute -inset-1 rounded-full blur-lg transition-all duration-300 opacity-0 group-hover:opacity-100 ${
                    isScrolled ? "bg-primary/40" : "bg-white/30"
                  }`} />
                  <Button 
                    className={`relative rounded-full px-6 py-2.5 font-bold text-sm transition-all duration-300 overflow-hidden ${
                      isScrolled 
                        ? "bg-gradient-to-r from-primary via-primary to-orange-500 hover:shadow-lg hover:shadow-primary/25 text-white border-0" 
                        : "bg-white hover:bg-white/95 text-primary shadow-xl"
                    }`}
                  >
                    {/* Shimmer effect */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <Flame className="w-4 h-4 mr-1.5 text-orange-500" />
                    <span className="relative">Order Now</span>
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </motion.div>
              </Link>
            </div>

            {/* Profile / User Menu - Premium Design (Desktop Only) */}
            {hasMounted && user ? (
              <div className="relative hidden md:block" ref={userMenuRef}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl transition-all duration-300 ${
                    !isScrolled
                      ? "text-white hover:bg-white/15 backdrop-blur-sm"
                      : "text-foreground hover:bg-secondary/80"
                  } ${isUserMenuOpen ? (isScrolled ? "bg-secondary" : "bg-white/20") : ""}`}
                >
                  {/* Premium User Avatar with animated ring */}
                  <div className="relative">
                    <div className={`absolute -inset-1 rounded-full transition-all duration-300 ${
                      isUserMenuOpen 
                        ? "bg-gradient-to-r from-primary via-orange-500 to-primary animate-spin-slow opacity-100" 
                        : "opacity-0"
                    }`} style={{ animationDuration: "3s" }} />
                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2 transition-all duration-300 ${
                      isScrolled 
                        ? "bg-gradient-to-br from-primary to-orange-500 text-white ring-primary/30" 
                        : "bg-white text-primary ring-white/50"
                    }`}>
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {/* Premium online indicator with pulse */}
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-background"></span>
                      </span>
                    </div>
                  </div>
                  <div className="hidden lg:flex flex-col items-start">
                    <span className="font-semibold text-sm max-w-[100px] truncate leading-tight">
                      {user.name?.split(' ')[0] || 'User'}
                    </span>
                    <span className={`text-[10px] leading-tight ${isScrolled ? "text-muted-foreground" : "text-white/70"}`}>
                      {userType === 'admin' ? 'Administrator' : userType === 'employee' ? 'Staff Member' : 'Premium Member'}
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </motion.button>

                {/* Premium User Dropdown Menu */}
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute right-0 mt-3 w-72 bg-background/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/50 overflow-hidden z-50"
                    >
                      {/* Premium User Info Header with gradient */}
                      <div className="relative p-5 bg-gradient-to-br from-primary/15 via-orange-500/10 to-primary/5 border-b border-border/50">
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />
                        <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
                        
                        <div className="relative flex items-center gap-4">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
                              {user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            {/* Crown badge for premium feel */}
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                              <Crown className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-lg truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-[10px] text-green-600 font-medium">Active Now</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items with premium styling */}
                      <div className="py-2 px-2">
                        {userMenuItems.map((item, index) => (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <Link
                              href={item.href}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/80 rounded-xl transition-all duration-200 group"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                                item.color.replace("text-", "bg-").replace("500", "100")
                              } group-hover:scale-110`}>
                                <item.icon className={`h-4.5 w-4.5 ${item.color}`} />
                              </div>
                              <span className="font-medium text-sm">{item.label}</span>
                              <ArrowRight className="w-4 h-4 ml-auto opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0 transition-all" />
                            </Link>
                          </motion.div>
                        ))}
                      </div>

                      {/* Sign Out - Premium styling */}
                      <div className="border-t border-border/50 p-2">
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all duration-200 group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                            <LogOut className="h-4.5 w-4.5" />
                          </div>
                          <span className="font-semibold text-sm">Sign Out</span>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : hasMounted ? (
              <Link href="/auth" className="hidden md:block">
                <motion.div 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                  className="relative group"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-xl w-11 h-11 transition-all duration-300 ${
                      !isScrolled
                        ? "text-white hover:text-white hover:bg-white/20 backdrop-blur-sm"
                        : "hover:bg-secondary"
                    }`}
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
            ) : (
              // Placeholder during SSR/hydration to prevent mismatch
              <div className="hidden md:block w-11 h-11" />
            )}
            {/* Premium Cart Button */}
            <Link href="/cart">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative group"
              >
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`relative rounded-xl w-11 h-11 transition-all duration-300 ${
                    !isScrolled 
                      ? "text-white hover:text-white hover:bg-white/20 backdrop-blur-sm" 
                      : "hover:bg-secondary"
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`absolute -top-1 -right-1 text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-lg ${
                        isScrolled 
                          ? "bg-gradient-to-r from-primary to-orange-500 text-white" 
                          : "bg-white text-primary"
                      }`}
                    >
                      {totalItems > 99 ? '99+' : totalItems}
                    </motion.span>
                  )}
                </Button>
                {/* Pulse ring for items in cart */}
                {totalItems > 0 && (
                  <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full animate-ping ${
                    isScrolled ? "bg-primary/30" : "bg-white/30"
                  }`} />
                )}
              </motion.div>
            </Link>

            {/* Premium Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className={`md:hidden rounded-xl w-11 h-11 transition-all duration-300 ${
                !isScrolled 
                  ? "text-white hover:text-white hover:bg-white/20 backdrop-blur-sm" 
                  : "hover:bg-secondary"
              }`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <motion.div
                animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </motion.div>
            </Button>
          </div>
        </div>
      </nav>

      {/* Premium Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={disableAnimations ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={disableAnimations ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={disableAnimations ? { duration: 0.1 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 shadow-2xl"
            style={{ maxHeight: 'calc(100dvh - 64px)' }}
          >
            <div 
              className="container-custom py-5 flex flex-col gap-2 overflow-y-auto overscroll-contain touch-pan-y scrollbar-thin"
              style={{ 
                maxHeight: 'calc(100dvh - 64px)', 
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {/* Premium User Info - Mobile */}
              {user && (
                <motion.div
                  initial={disableAnimations ? false : { opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={disableAnimations ? { duration: 0 } : undefined}
                  className="mb-4 p-5 bg-gradient-to-br from-primary/15 via-orange-500/10 to-primary/5 rounded-3xl border border-primary/10 relative overflow-hidden"
                >
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />
                  
                  <div className="relative flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                        <Crown className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-2 h-2 rounded-full bg-green-500 ${disableAnimations ? '' : 'animate-pulse'}`} />
                        <span className="text-[11px] text-green-600 font-medium">Active Now</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Premium Nav Links - Mobile */}
              <div className="space-y-1">
                {navLinks.map((link, index) => {
                  const Icon = link.icon;
                  return (
                    <motion.div
                      key={link.path}
                      initial={disableAnimations ? false : { opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={disableAnimations ? { duration: 0 } : { delay: index * 0.05 }}
                    >
                      <Link
                        href={link.path}
                        className={`flex items-center gap-4 py-3.5 px-4 rounded-2xl text-base font-semibold transition-all duration-200 ${
                          pathname === link.path
                            ? "text-primary bg-primary/10 shadow-sm"
                            : "text-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {pathname === link.path && !disableAnimations && (
                          <motion.div
                            layoutId="mobileActive"
                            className="w-1 h-6 bg-gradient-to-b from-primary to-orange-500 rounded-full"
                          />
                        )}
                        {pathname === link.path && disableAnimations && (
                          <div className="w-1 h-6 bg-gradient-to-b from-primary to-orange-500 rounded-full" />
                        )}
                        {Icon && (
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            pathname === link.path ? "bg-primary/20" : "bg-secondary"
                          }`}>
                            <Icon className={`w-4.5 h-4.5 ${pathname === link.path ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                        )}
                        {link.name}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* Premium User Menu Items - Mobile */}
              {user && (
                <>
                  <div className="my-3 border-t border-border/50 pt-3">
                    <p className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <span className="w-8 h-[1px] bg-border/50" />
                      My Account
                      <span className="flex-1 h-[1px] bg-border/50" />
                    </p>
                  </div>
                  <div className="space-y-1">
                    {userMenuItems.map((item, index) => (
                      <motion.div
                        key={item.href}
                        initial={disableAnimations ? false : { opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={disableAnimations ? { duration: 0 } : { delay: (navLinks.length + index) * 0.05 }}
                      >
                        <Link
                          href={item.href}
                          className="flex items-center gap-4 py-3.5 px-4 rounded-2xl text-base font-semibold transition-all duration-200 text-foreground hover:bg-secondary/80"
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            item.color.replace("text-", "bg-").replace("500", "100")
                          }`}>
                            <item.icon className={`h-4.5 w-4.5 ${item.color}`} />
                          </div>
                          {item.label}
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                  <motion.div
                    initial={disableAnimations ? false : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={disableAnimations ? { duration: 0 } : { delay: (navLinks.length + userMenuItems.length) * 0.05 }}
                    className="mt-2"
                  >
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-4 py-3.5 px-4 rounded-2xl text-base font-semibold text-red-500 hover:bg-red-500/10 transition-all duration-200"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                        <LogOut className="h-4.5 w-4.5" />
                      </div>
                      Sign Out
                    </button>
                  </motion.div>
                </>
              )}

              {/* Premium Order Now Button - Mobile */}
              <motion.div
                initial={disableAnimations ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={disableAnimations ? { duration: 0 } : { delay: 0.3 }}
                className="pt-4 mt-2"
              >
                <Link href="/menu">
                  <Button className="w-full bg-gradient-to-r from-primary via-primary to-orange-500 hover:opacity-90 rounded-2xl py-6 text-base font-bold shadow-lg shadow-primary/25 relative overflow-hidden group">
                    {!disableAnimations && (
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    )}
                    <Flame className="w-5 h-5 mr-2 text-orange-200" />
                    Order Now
                    <ArrowRight className={`w-5 h-5 ml-2 ${disableAnimations ? '' : 'group-hover:translate-x-1 transition-transform'}`} />
                  </Button>
                </Link>
              </motion.div>

              {/* Premium Login Button - Mobile (when not logged in) */}
              {!user && (
                <motion.div
                  initial={disableAnimations ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={disableAnimations ? { duration: 0 } : { delay: 0.35 }}
                >
                  <Link href="/auth">
                    <Button variant="outline" className="w-full rounded-2xl py-6 text-base font-bold border-2 hover:bg-secondary/50 transition-all">
                      <User className="w-5 h-5 mr-2" />
                      Login / Sign Up
                    </Button>
                  </Link>
                </motion.div>
              )}
              
              {/* Safe area padding for bottom */}
              <div className="h-6 flex-shrink-0" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocked Customer Dialog */}
      <BlockedCustomerDialog
        open={isBanned}
        reason={banReason || ''}
        onLogout={fastSignOut}
        autoLogoutSeconds={5}
      />
    </motion.header>
  );
}

// Export memoized Navbar to prevent unnecessary re-renders
export default memo(Navbar);
