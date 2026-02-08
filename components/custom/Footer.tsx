"use client";

import { motion, useInView } from "framer-motion";
import { useRef, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Clock, Facebook, Instagram, Twitter } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

// Simplified variants for mobile
const simplifiedContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02,
      delayChildren: 0.05,
    },
  },
};

const simplifiedItemVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15 },
  },
};

function Footer() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const shouldReduceMotion = useReducedMotion();

  const activeContainerVariants = shouldReduceMotion ? simplifiedContainerVariants : containerVariants;
  const activeItemVariants = shouldReduceMotion ? simplifiedItemVariants : itemVariants;

  return (
    <footer className="bg-foreground text-background overflow-hidden" ref={ref}>
      <div className="container-custom py-12 sm:py-16 md:py-20">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12"
          variants={activeContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {/* Brand */}
          <motion.div variants={activeItemVariants} className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <motion.div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-lg relative"
                initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={shouldReduceMotion ? { duration: 0.15 } : { delay: 0.1, type: "spring" }}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.1, rotate: 5 }}
              >
                <Image 
                  src="/assets/zoiro-logo.png" 
                  alt="ZOIRO Injected Broast" 
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </motion.div>
              <motion.h3
                className="text-3xl sm:text-4xl font-bebas text-primary"
                initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={shouldReduceMotion ? { duration: 0.15 } : { delay: 0.1, type: "spring" }}
              >
                ZOIRO
              </motion.h3>
            </div>
            <p className="text-background/70 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed">
              Zoiro Broast - Premium injected broast chicken in Vehari City. 
              Crispy, juicy, and unforgettable taste. Best broast in Vehari with fast home delivery.
            </p>
            <div className="flex gap-3 sm:gap-4">
              {[Facebook, Instagram, Twitter].map((Icon, index) => (
                <motion.a
                  key={index}
                  href="#"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/20 hover:bg-primary flex items-center justify-center transition-colors"
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.2, rotate: 5 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                  initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={shouldReduceMotion ? { duration: 0.15 } : { delay: 0.3 + index * 0.1 }}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={activeItemVariants}>
            <h4 className="text-lg sm:text-xl font-bebas mb-3 sm:mb-4">Quick Links</h4>
            <ul className="space-y-2 sm:space-y-3">
              {[
                { href: "/", label: "Home" },
                { href: "/menu", label: "Zoiro Broast Menu" },
                { href: "/contact", label: "Contact Us" },
                { href: "/cart", label: "Order Online" },
                { href: "/reviews", label: "Customer Reviews" },
                { href: "/terms", label: "Terms & Conditions" },
                { href: "/privacy", label: "Privacy Policy" },
              ].map((link, index) => (
                <motion.li
                  key={link.href}
                  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={shouldReduceMotion ? { duration: 0.1 } : { delay: 0.4 + index * 0.05 }}
                >
                  <Link
                    href={link.href}
                    className="text-background/70 hover:text-primary transition-colors inline-block text-sm sm:text-base"
                  >
                    <motion.span whileHover={shouldReduceMotion ? undefined : { x: 5 }} className="inline-block">
                      {link.label}
                    </motion.span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Contact Info */}
          <motion.div variants={activeItemVariants}>
            <h4 className="text-lg sm:text-xl font-bebas mb-3 sm:mb-4">Contact Info</h4>
            <ul className="space-y-3 sm:space-y-4">
              {[
                { Icon: MapPin, text: "Near Baba G Kulfi, Faisal Town, Vehari" },
                { Icon: Phone, text: "+92 304 629 2822" },
                { Icon: Clock, text: "Daily: 11:00 AM - 11:00 PM" },
              ].map((item, index) => (
                <motion.li
                  key={index}
                  className="flex items-start gap-2 sm:gap-3"
                  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={shouldReduceMotion ? { duration: 0.1 } : { delay: 0.5 + index * 0.1 }}
                  whileHover={shouldReduceMotion ? undefined : { x: 5 }}
                >
                  <motion.div whileHover={shouldReduceMotion ? undefined : { scale: 1.2, rotate: 10 }}>
                    <item.Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                  </motion.div>
                  <span className="text-background/70 text-sm sm:text-base">{item.text}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Opening Hours */}
          <motion.div variants={activeItemVariants}>
            <h4 className="text-lg sm:text-xl font-bebas mb-3 sm:mb-4">Opening Hours</h4>
            <ul className="space-y-2 sm:space-y-3 text-background/70 text-sm sm:text-base">
              {[
                { days: "Monday - Thursday", hours: "11AM - 10PM" },
                { days: "Friday - Saturday", hours: "11AM - 11PM" },
                { days: "Sunday", hours: "12PM - 10PM" },
              ].map((item, index) => (
                <motion.li
                  key={index}
                  className="flex justify-between gap-2"
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={shouldReduceMotion ? { duration: 0.1 } : { delay: 0.6 + index * 0.1 }}
                >
                  <span className="text-xs sm:text-sm">{item.days}</span>
                  <span className="text-xs sm:text-sm font-medium">{item.hours}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom Bar */}
        <div
          className="border-t border-background/20 mt-8 sm:mt-12 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4"
        >
          <p className="text-background/50 text-xs sm:text-sm text-center md:text-left">
            © 2025 Zoiro Broast (ZOIRO Injected Broast) Vehari. All rights reserved.
          </p>

          {/* Developer Button */}
          <motion.a
            href="https://waqarx.me"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
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

          <p className="text-background/50 text-xs sm:text-sm">
            Made with ❤️ in Vehari City | Best Broast Chicken in Vehari
          </p>
        </div>

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
      </div>
    </footer>
  );
}

// Export memoized Footer to prevent unnecessary re-renders
export default memo(Footer);
