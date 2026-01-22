"use client";

import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { MapPin, Phone, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function LocationSection() {
  const ref = useRef(null);
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Parallax transforms - disabled on mobile
  const mapY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [80, -80]);
  const contentY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [60, -60]);
  const bgY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [50, -150]);

  // Simplified animation config for mobile
  const animationDuration = shouldReduceMotion ? 0.15 : 0.8;

  return (
    <section className="section-padding overflow-hidden relative" ref={containerRef}>
      {/* Parallax Background Elements - Hidden on mobile */}
      {!shouldReduceMotion && (
        <motion.div 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ y: bgY }}
        >
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </motion.div>
      )}

      <div className="container-custom relative z-10" ref={ref}>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Map / Image Side with Parallax */}
          <motion.div
            initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -80, scale: shouldReduceMotion ? 1 : 0.9 }}
            animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
            transition={{ duration: animationDuration, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative rounded-xl sm:rounded-2xl overflow-hidden h-64 sm:h-80 lg:h-96 bg-muted"
            style={shouldReduceMotion ? {} : { y: mapY }}
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d110094.32834645576!2d72.27752705!3d30.02969975!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3922f5e4e4e4e4e5%3A0x1a1a1a1a1a1a1a1a!2sVehari%2C%20Punjab%2C%20Pakistan!5e0!3m2!1sen!2s!4v1700000000000!5m2!1sen!2s"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="ZOIRO Location"
            />
            {/* Overlay glow effect - only on desktop */}
            {!shouldReduceMotion && (
              <motion.div
                className="absolute inset-0 pointer-events-none border-4 border-primary/0 rounded-xl sm:rounded-2xl"
                initial={{ borderColor: "rgba(var(--primary), 0)" }}
                whileHover={{ borderColor: "rgba(var(--primary), 0.3)" }}
                transition={{ duration: 0.3 }}
              />
            )}
          </motion.div>

          {/* Content Side with Parallax */}
          <motion.div
            initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 80 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: animationDuration, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={shouldReduceMotion ? {} : { y: contentY }}
            className="px-2 sm:px-0"
          >
            <motion.span
              className="text-primary font-semibold uppercase tracking-wider text-xs sm:text-sm inline-block"
              initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: shouldReduceMotion ? 0.05 : 0.2, duration: animationDuration }}
            >
              Visit Us
            </motion.span>
            <motion.h2
              className="text-3xl sm:text-4xl md:text-5xl font-bebas mt-2 mb-4 sm:mb-6"
              initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 30, filter: shouldReduceMotion ? "blur(0px)" : "blur(10px)" }}
              animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
              transition={{ delay: shouldReduceMotion ? 0.08 : 0.3, duration: animationDuration }}
            >
              Find Us in <span className="text-primary">Vehari City</span>
            </motion.h2>
            <motion.p
              className="text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8 leading-relaxed"
              initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: shouldReduceMotion ? 0.1 : 0.4, duration: animationDuration }}
            >
              Located in the heart of Vehari, we're easily accessible and ready
              to serve you the best broast experience in town.
            </motion.p>

            {/* Contact Info Cards */}
            <motion.div
              className="space-y-3 sm:space-y-4 mb-6 sm:mb-8"
              variants={shouldReduceMotion ? {
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.02 } }
              } : containerVariants}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
            >
              <motion.div
                variants={shouldReduceMotion ? {
                  hidden: { opacity: 0, x: 0 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.15 } }
                } : cardVariants}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-secondary rounded-lg sm:rounded-xl"
                whileHover={shouldReduceMotion ? undefined : { x: 10, backgroundColor: "hsl(var(--secondary) / 0.8)" }}
              >
                <motion.div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                  whileHover={shouldReduceMotion ? undefined : { rotate: 10, scale: 1.1 }}
                >
                  <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </motion.div>
                <div>
                  <p className="font-semibold text-sm sm:text-base">Address</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Main Bazaar, Vehari City, Punjab, Pakistan
                  </p>
                </div>
              </motion.div>

              <motion.div
                variants={shouldReduceMotion ? {
                  hidden: { opacity: 0, x: 0 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.15 } }
                } : cardVariants}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-secondary rounded-lg sm:rounded-xl"
                whileHover={shouldReduceMotion ? undefined : { x: 10, backgroundColor: "hsl(var(--secondary) / 0.8)" }}
              >
                <motion.div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                  whileHover={shouldReduceMotion ? undefined : { rotate: 10, scale: 1.1 }}
                >
                  <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </motion.div>
                <div>
                  <p className="font-semibold text-sm sm:text-base">Phone</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    +92 300 1234567
                  </p>
                </div>
              </motion.div>

              <motion.div
                variants={shouldReduceMotion ? {
                  hidden: { opacity: 0, x: 0 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.15 } }
                } : cardVariants}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-secondary rounded-lg sm:rounded-xl"
                whileHover={shouldReduceMotion ? undefined : { x: 10, backgroundColor: "hsl(var(--secondary) / 0.8)" }}
              >
                <motion.div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                  whileHover={shouldReduceMotion ? undefined : { rotate: 10, scale: 1.1 }}
                >
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </motion.div>
                <div>
                  <p className="font-semibold text-sm sm:text-base">Opening Hours</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Mon - Sun: 11:00 AM - 11:00 PM
                  </p>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: shouldReduceMotion ? 0.15 : 0.8, duration: animationDuration }}
            >
              <Link href="/contact">
                <motion.div whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }} whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}>
                  <Button className="btn-zoiro w-full sm:w-auto">Get Directions</Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
