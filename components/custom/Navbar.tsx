"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu, X, ShoppingCart, User, Sparkles, Phone, 
  LogOut, Settings, Package, Heart, Award, CreditCard,
  MapPin, ChevronDown, Bell, History
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BlockedCustomerDialog } from "./BlockedCustomerDialog";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import dynamic from "next/dynamic";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Import chicken animation
import chickenAnimation from "@/public/assets/chicken-lottie.json";

const baseNavLinks = [
  { name: "Home", path: "/" },
  { name: "Menu", path: "/menu" },
  { name: "Reviews", path: "/reviews" },
  { name: "Contact", path: "/contact" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHoveredLink, setIsHoveredLink] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const { user, signOut, fastSignOut, isBanned, banReason } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  // Dynamic nav links - show Features only for non-logged-in users
  const navLinks = useMemo(() => {
    if (user) {
      return baseNavLinks;
    }
    // Insert Features link after Home for non-logged-in users
    return [
      baseNavLinks[0], // Home
      { name: "Features", path: "/features" },
      ...baseNavLinks.slice(1), // Menu, Reviews, Contact
    ];
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
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

  const handleSignOut = async () => {
    await signOut();
    setIsUserMenuOpen(false);
    router.push("/");
  };

  // User dropdown menu items
  const userMenuItems = [
    { icon: Package, label: "My Orders", href: "/orders", color: "text-blue-500" },
    { icon: History, label: "Order History", href: "/orders/history", color: "text-purple-500" },
    { icon: MapPin, label: "Track Order", href: "/orders/track", color: "text-green-500" },
    { icon: Award, label: "Loyalty Points", href: "/loyalty", color: "text-yellow-500" },
    { icon: CreditCard, label: "Payments", href: "/payments", color: "text-emerald-500" },
    { icon: Heart, label: "Favorites", href: "/favorites", color: "text-red-500" },
    { icon: Settings, label: "Settings", href: "/settings", color: "text-gray-500" },
  ];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-background/95 backdrop-blur-md shadow-lg py-1"
          : "bg-gradient-to-r from-primary via-primary to-orange-500 shadow-md py-0"
      }`}
    >
      {/* Top promotional bar - only show when not scrolled */}
      <AnimatePresence>
        {!isScrolled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-foreground/10 backdrop-blur-sm border-b border-white/10 overflow-hidden"
          >
            <div className="container-custom py-1.5">
              <div className="flex items-center justify-center gap-4 text-xs text-white/90">
                <motion.div 
                  className="flex items-center gap-1"
                  animate={shouldReduceMotion ? undefined : { scale: [1, 1.05, 1] }}
                  transition={shouldReduceMotion ? undefined : { duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                  <span>Free delivery on orders above Rs. 1500</span>
                </motion.div>
                <span className="hidden sm:inline text-white/50">|</span>
                <div className="hidden sm:flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>Call: 0300-1234567</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="container-custom">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo with Image */}
          <Link href="/" className="flex items-center gap-2">
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
              className="flex items-center gap-2"
            >
              {/* Logo Image */}
              <motion.div 
                className="w-12 h-12 md:w-14 md:h-14 relative rounded-xl overflow-hidden shadow-lg"
                animate={shouldReduceMotion ? undefined : { rotate: [0, 2, -2, 0] }}
                transition={shouldReduceMotion ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <img 
                  src="/assets/zoiro-logo.png" 
                  alt="ZOIRO Broast"
                  className="w-full h-full object-cover"
                />
              </motion.div>
              
              {/* Logo Text */}
              <div className="flex flex-col leading-none">
                <span className={`text-2xl md:text-3xl font-bebas tracking-wider transition-colors ${
                  isScrolled ? "text-primary" : "text-white"
                }`}>
                  ZOIRO
                </span>
                <span className={`text-[8px] md:text-[10px] font-medium tracking-widest transition-colors ${
                  isScrolled ? "text-muted-foreground" : "text-white/70"
                }`}>
                  BROAST
                </span>
              </div>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link, index) => (
              <Link
                key={link.path}
                href={link.path}
                className="relative px-4 py-2"
                onMouseEnter={() => setIsHoveredLink(link.path)}
                onMouseLeave={() => setIsHoveredLink(null)}
              >
                {/* Background highlight */}
                <motion.div
                  className={`absolute inset-0 rounded-full ${isScrolled ? "bg-primary/10" : "bg-white/10"}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: isHoveredLink === link.path || pathname === link.path ? 1 : 0,
                    opacity: isHoveredLink === link.path || pathname === link.path ? 1 : 0,
                  }}
                  transition={{ duration: 0.2 }}
                />
                
                <motion.span
                  className={`relative z-10 font-medium transition-colors ${
                    pathname === link.path
                      ? isScrolled ? "text-primary font-bold" : "text-white font-bold"
                      : isScrolled
                      ? "text-foreground hover:text-primary"
                      : "text-white/90 hover:text-white"
                  }`}
                  animate={{
                    y: isHoveredLink === link.path ? -2 : 0,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {link.name}
                </motion.span>
                
                {/* Active indicator dot */}
                {pathname === link.path && (
                  <motion.div
                    layoutId="activeIndicator"
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                      isScrolled ? "bg-primary" : "bg-white"
                    }`}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Order Now Button - Desktop */}
            <motion.div 
              className="hidden lg:block"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link href="/menu">
                <Button 
                  className={`rounded-full px-5 font-semibold ${
                    isScrolled 
                      ? "bg-primary hover:bg-primary/90 text-white" 
                      : "bg-white text-primary hover:bg-white/90"
                  }`}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Order Now
                </Button>
              </Link>
            </motion.div>

            {/* Profile / User Menu - Shows when logged in */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${
                    !isScrolled
                      ? "text-white hover:bg-white/20"
                      : "text-foreground hover:bg-primary/10"
                  }`}
                >
                  {/* User Avatar with green online indicator */}
                  <div className="relative">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                      isScrolled ? "bg-primary text-white" : "bg-white text-primary"
                    }`}>
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                  </div>
                  <span className="hidden lg:block font-medium max-w-[100px] truncate">
                    {user.name?.split(' ')[0] || 'User'}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </motion.button>

                {/* User Dropdown Menu */}
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-64 bg-background rounded-2xl shadow-xl border overflow-hidden z-50"
                    >
                      {/* User Info Header */}
                      <div className="p-4 bg-gradient-to-r from-primary/10 to-orange-500/10 border-b">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold">
                              {user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            {/* Online indicator */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        {userMenuItems.map((item, index) => (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Link
                              href={item.href}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              <item.icon className={`h-5 w-5 ${item.color}`} />
                              <span className="font-medium">{item.label}</span>
                            </Link>
                          </motion.div>
                        ))}
                      </div>

                      {/* Sign Out */}
                      <div className="border-t p-2">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          <LogOut className="h-5 w-5" />
                          <span className="font-medium">Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href="/auth">
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full ${
                      !isScrolled
                        ? "text-white hover:text-white hover:bg-white/20"
                        : "hover:bg-primary/10"
                    }`}
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
            )}

            {/* Cart */}
            <Link href="/cart">
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="relative"
              >
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`relative rounded-full ${
                    !isScrolled 
                      ? "text-white hover:text-white hover:bg-white/20" 
                      : "hover:bg-primary/10"
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`absolute -top-1 -right-1 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ${
                        isScrolled 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-white text-primary"
                      }`}
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </Button>
              </motion.div>
            </Link>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className={`md:hidden rounded-full ${
                !isScrolled 
                  ? "text-white hover:text-white hover:bg-white/20" 
                  : "hover:bg-primary/10"
              }`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <motion.div
                animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
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

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-background border-t shadow-lg overflow-hidden"
          >
            <div className="container-custom py-4 flex flex-col gap-2">
              {/* User Info - Mobile */}
              {user && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-4 bg-gradient-to-r from-primary/10 to-orange-500/10 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      {/* Online indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {navLinks.map((link, index) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={shouldReduceMotion ? { duration: 0.1 } : { delay: index * 0.1 }}
                >
                  <Link
                    href={link.path}
                    className={`flex items-center gap-3 py-3 px-4 rounded-xl text-lg font-medium transition-colors ${
                      pathname === link.path
                        ? "text-primary bg-primary/10"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    {pathname === link.path && (
                      <motion.div
                        layoutId="mobileActive"
                        className="w-1 h-6 bg-primary rounded-full"
                      />
                    )}
                    {link.name}
                  </Link>
                </motion.div>
              ))}

              {/* User Menu Items - Mobile */}
              {user && (
                <>
                  <div className="my-2 border-t pt-2">
                    <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      My Account
                    </p>
                  </div>
                  {userMenuItems.map((item, index) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={shouldReduceMotion ? { duration: 0.1 } : { delay: (navLinks.length + index) * 0.1 }}
                    >
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 py-3 px-4 rounded-xl text-lg font-medium transition-colors text-foreground hover:bg-secondary"
                      >
                        <item.icon className={`h-5 w-5 ${item.color}`} />
                        {item.label}
                      </Link>
                    </motion.div>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={shouldReduceMotion ? { duration: 0.1 } : { delay: (navLinks.length + userMenuItems.length) * 0.1 }}
                  >
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 py-3 px-4 rounded-xl text-lg font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-5 w-5" />
                      Sign Out
                    </button>
                  </motion.div>
                </>
              )}

              <motion.div
                initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={shouldReduceMotion ? { duration: 0.1 } : { delay: 0.4 }}
                className="pt-2"
              >
                <Link href="/menu">
                  <Button className="w-full bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 rounded-xl py-6 text-lg">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Order Now
                  </Button>
                </Link>
              </motion.div>

              {/* Login Button - Mobile (when not logged in) */}
              {!user && (
                <motion.div
                  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={shouldReduceMotion ? { duration: 0.1 } : { delay: 0.5 }}
                >
                  <Link href="/auth">
                    <Button variant="outline" className="w-full rounded-xl py-6 text-lg">
                      <User className="w-5 h-5 mr-2" />
                      Login / Sign Up
                    </Button>
                  </Link>
                </motion.div>
              )}
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