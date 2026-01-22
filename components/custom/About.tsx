"use client";

import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Award, Clock, ThumbsUp, Users } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const chickenPiece = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80";

const features = [
  {
    icon: Award,
    title: "Premium Quality",
    description: "Only the finest ingredients for authentic taste",
  },
  {
    icon: Clock,
    title: "Fast Service",
    description: "Quick preparation and speedy delivery",
  },
  {
    icon: ThumbsUp,
    title: "Hygienic Kitchen",
    description: "Strict cleanliness standards maintained",
  },
  {
    icon: Users,
    title: "Family Friendly",
    description: "Perfect portions for every family size",
  },
];

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

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function About() {
  const ref = useRef(null);
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const shouldReduceMotion = useReducedMotion();
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Parallax transforms - disabled on mobile
  const imageY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [100, -100]);
  const decorY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [50, -150]);
  const decorRotate = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, 180]);
  const contentY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [80, -40]);

  // Simplified animation config for mobile
  const animationDuration = shouldReduceMotion ? 0.15 : 0.8;

  return (
    <section className="section-padding overflow-hidden relative" ref={containerRef}>
      {/* Background Parallax Elements - Hidden on mobile for performance */}
      {!shouldReduceMotion && (
        <motion.div 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ y: decorY }}
        >
          <div className="absolute top-20 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 -right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </motion.div>
      )}

      <div className="container-custom relative z-10" ref={ref}>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Image Side with Parallax */}
          <motion.div
            initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -80, rotateY: shouldReduceMotion ? 0 : -15 }}
            animate={isInView ? { opacity: 1, x: 0, rotateY: 0 } : {}}
            transition={{ duration: animationDuration, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative perspective-1000"
            style={shouldReduceMotion ? {} : { y: imageY }}
          >
            <div className="relative z-10">
              <motion.img
                src={chickenPiece}
                alt="Delicious Broast Chicken"
                className="w-full max-w-md mx-auto"
                initial={{ scale: shouldReduceMotion ? 1 : 0.8, filter: shouldReduceMotion ? "blur(0px)" : "blur(10px)" }}
                animate={isInView ? { scale: 1, filter: "blur(0px)" } : {}}
                transition={{ duration: animationDuration, delay: shouldReduceMotion ? 0 : 0.2 }}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05, rotate: 5 }}
              />
            </div>
            {/* Decorative Elements with Parallax - Hidden on mobile */}
            {!shouldReduceMotion && (
              <>
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-3xl"
                  style={{ y: decorY }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isInView ? { scale: 1, opacity: 1 } : {}}
                  transition={{ duration: 1, delay: 0.3 }}
                />
                <motion.div
                  style={{ rotate: decorRotate }}
                  className="absolute top-0 right-0 w-32 h-32 border-4 border-dashed border-primary/30 rounded-full"
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                />
                <motion.div
                  className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/20 rounded-full"
                  style={{ y: decorY }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />
              </>
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
              About Us
            </motion.span>
            <motion.h2
              className="text-3xl sm:text-4xl md:text-5xl font-bebas mt-2 mb-4 sm:mb-6"
              initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: shouldReduceMotion ? 0.1 : 0.3, duration: animationDuration }}
            >
              The Taste That Makes
              <br />
              <span className="text-primary">Vehari City</span> Proud
            </motion.h2>
            <motion.p
              className="text-muted-foreground mb-8"
              initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: shouldReduceMotion ? 0.1 : 0.4, duration: animationDuration }}
            >
              At ZOIRO, we believe in serving more than just food – we serve
              experiences. Our signature Injected Broast is made with a secret
              blend of spices, perfected over years, and pressure-cooked to
              achieve that perfect crispy exterior and juicy interior.
            </motion.p>
            <motion.p
              className="text-muted-foreground mb-8"
              initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: shouldReduceMotion ? 0.15 : 0.5, duration: animationDuration }}
            >
              Every piece of chicken is carefully selected, marinated for hours,
              and prepared fresh to order. Our commitment to quality has made us
              the go-to destination for broast lovers in Vehari.
            </motion.p>

            {/* Features Grid - Mobile Optimized */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"
              variants={shouldReduceMotion ? {
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.02 } }
              } : containerVariants}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
            >
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  variants={shouldReduceMotion ? {
                    hidden: { opacity: 0, y: 5 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.15 } }
                  } : itemVariants}
                  className="flex items-start gap-3 group p-3 sm:p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.02, x: 5 }}
                >
                  <motion.div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"
                    whileHover={shouldReduceMotion ? undefined : { rotate: 10, scale: 1.1 }}
                  >
                    <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </motion.div>
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-0.5 sm:mb-1 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
