"use client";

import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Star, Quote, Loader2 } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Review {
  id: string;
  customer: {
    name: string;
    initial: string;
  };
  rating: number;
  comment: string;
  review_type: string;
  is_verified: boolean;
  created_at: string;
}

interface ReviewStats {
  total_reviews: number;
  average_rating: number;
}

function AnimatedCounter({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, value, decimals]);

  return (
    <span ref={ref}>
      {decimals > 0 ? displayValue.toFixed(decimals) : displayValue.toLocaleString()}{suffix}
    </span>
  );
}

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

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 50,
    scale: 0.9,
  },
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

const statsVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const shouldReduceMotion = useReducedMotion();
  
  const ref = useRef(null);
  const statsRef = useRef(null);
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const statsInView = useInView(statsRef, { once: true, margin: "-50px" });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Parallax transforms - disabled on mobile
  const bgY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [80, -80]);
  const contentY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [40, -40]);

  // Simplified animation config for mobile
  const animationDuration = shouldReduceMotion ? 0.15 : 0.7;

  // Fetch reviews on mount
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch('/api/customer/reviews?limit=4&sort=helpful');
        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews || []);
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  // Calculate time ago
  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return (
    <section className="section-padding bg-foreground text-background overflow-hidden relative" ref={containerRef}>
      {/* Parallax Background Elements - Hidden on mobile */}
      {!shouldReduceMotion && (
        <motion.div 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ y: bgY }}
        >
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </motion.div>
      )}

      <motion.div className="container-custom relative z-10" style={shouldReduceMotion ? {} : { y: contentY }} ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 10 : 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: animationDuration, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-12"
        >
          <motion.span
            className="text-primary font-semibold uppercase tracking-wider text-sm inline-block"
            initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: shouldReduceMotion ? 0.02 : 0.1, duration: animationDuration }}
          >
            Testimonials
          </motion.span>
          <motion.h2
            className="text-4xl sm:text-5xl font-bebas mt-2 mb-4"
            initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 30, filter: shouldReduceMotion ? "blur(0px)" : "blur(10px)" }}
            animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ delay: shouldReduceMotion ? 0.05 : 0.2, duration: animationDuration }}
          >
            What Our Customers Say
          </motion.h2>
          <motion.p
            className="text-background/70 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: shouldReduceMotion ? 0.08 : 0.3, duration: animationDuration }}
          >
            Real reviews from real customers. See what people love about ZOIRO.
          </motion.p>
        </motion.div>

        {/* Reviews Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-background/60">No reviews yet. Be the first to share your experience!</p>
          </div>
        ) : (
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={shouldReduceMotion ? {
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.02 } }
            } : containerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            {reviews.map((review, index) => (
              <motion.div
                key={review.id}
                variants={shouldReduceMotion ? {
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.15 } }
                } : cardVariants}
                className="bg-background/10 backdrop-blur-sm rounded-2xl p-6 relative group"
                whileHover={shouldReduceMotion ? undefined : { 
                  y: -8, 
                  scale: 1.02,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {!shouldReduceMotion && (
                  <motion.div
                    initial={{ opacity: 0, rotate: -20, scale: 0 }}
                    animate={isInView ? { opacity: 0.3, rotate: 0, scale: 1 } : {}}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/30 group-hover:text-primary/50 transition-colors" />
                  </motion.div>
                )}
                {shouldReduceMotion && (
                  <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/30 group-hover:text-primary/50 transition-colors" />
                )}
                
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    shouldReduceMotion ? (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating
                            ? "text-accent fill-accent"
                            : "text-background/30"
                        }`}
                      />
                    ) : (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={isInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.6 + index * 0.1 + i * 0.05 }}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            i < review.rating
                              ? "text-accent fill-accent"
                              : "text-background/30"
                          }`}
                        />
                      </motion.div>
                    )
                  ))}
                </div>

                {/* Comment */}
                <p className="text-background/80 mb-4 text-sm leading-relaxed line-clamp-3">
                  "{review.comment}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-semibold text-primary-foreground"
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.1, rotate: 5 }}
                  >
                    {review.customer.initial}
                  </motion.div>
                  <div>
                    <p className="font-semibold text-background">{review.customer.name}</p>
                    <p className="text-xs text-background/50">{getTimeAgo(review.created_at)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          ref={statsRef}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
          variants={shouldReduceMotion ? {
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.02 } }
          } : containerVariants}
          initial="hidden"
          animate={statsInView ? "visible" : "hidden"}
        >
          <motion.div 
            variants={shouldReduceMotion ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : statsVariants} 
            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
          >
            <p className="text-5xl font-bebas text-primary">
              {stats ? <AnimatedCounter value={stats.total_reviews} suffix="+" /> : '-'}
            </p>
            <p className="text-background/70 mt-1">Total Reviews</p>
          </motion.div>
          <motion.div 
            variants={shouldReduceMotion ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : statsVariants} 
            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
          >
            <p className="text-5xl font-bebas text-primary">
              {stats ? <AnimatedCounter value={stats.average_rating} decimals={1} /> : '-'}
            </p>
            <p className="text-background/70 mt-1">Average Rating</p>
          </motion.div>
          <motion.div 
            variants={shouldReduceMotion ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : statsVariants} 
            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
          >
            <p className="text-5xl font-bebas text-primary">
              <AnimatedCounter value={3000} suffix="+" />
            </p>
            <p className="text-background/70 mt-1">Happy Customers</p>
          </motion.div>
          <motion.div 
            variants={shouldReduceMotion ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : statsVariants} 
            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
          >
            <p className="text-5xl font-bebas text-primary">
              <AnimatedCounter value={99} suffix="%" />
            </p>
            <p className="text-background/70 mt-1">Satisfaction Rate</p>
          </motion.div>
        </motion.div>

        {/* View All Link */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: shouldReduceMotion ? 5 : 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: shouldReduceMotion ? 0.1 : 0.6, duration: animationDuration }}
        >
          <motion.a
            href="/reviews"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold"
          >
            View All Reviews
          </motion.a>
        </motion.div>
      </motion.div>
    </section>
  );
}
