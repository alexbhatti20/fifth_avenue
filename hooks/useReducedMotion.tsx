"use client";

import { useState, useEffect, useMemo } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect if heavy animations should be reduced
 * Returns true on mobile devices or when user prefers reduced motion
 */
export function useReducedMotion() {
  const [shouldReduce, setShouldReduce] = useState(true); // Default to reduced for SSR

  useEffect(() => {
    // Check mobile
    const checkMobile = () => window.innerWidth < MOBILE_BREAKPOINT;
    
    // Check reduced motion preference
    const checkReducedMotion = () => 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    const updateState = () => {
      setShouldReduce(checkMobile() || checkReducedMotion());
    };

    // Initial check
    updateState();

    // Listen for resize
    const handleResize = () => updateState();
    window.addEventListener('resize', handleResize);

    // Listen for reduced motion preference change
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => updateState();
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  return shouldReduce;
}

/**
 * Hook that provides animation variants optimized for mobile
 * Heavy animations (parallax, floating, infinite loops) are disabled on mobile
 */
export function useOptimizedAnimations() {
  const shouldReduce = useReducedMotion();

  const animationConfig = useMemo(() => ({
    // Whether to show any animations at all
    enabled: true,
    // Whether to show heavy animations (parallax, floating, infinite loops)
    heavyEnabled: !shouldReduce,
    // Duration for transitions
    duration: shouldReduce ? 0.15 : 0.5,
    // Stagger delay for lists
    stagger: shouldReduce ? 0.02 : 0.1,
    // Spring config
    spring: shouldReduce 
      ? { stiffness: 500, damping: 40 } 
      : { stiffness: 300, damping: 25 },
  }), [shouldReduce]);

  // Simplified variants for mobile
  const simpleVariants = useMemo(() => ({
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: animationConfig.stagger,
          delayChildren: 0.1,
        },
      },
    },
    item: {
      hidden: { opacity: 0, y: shouldReduce ? 10 : 30 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: animationConfig.duration,
        },
      },
    },
    fadeIn: {
      hidden: { opacity: 0 },
      visible: { 
        opacity: 1,
        transition: { duration: animationConfig.duration }
      },
    },
  }), [shouldReduce, animationConfig]);

  return {
    shouldReduce,
    config: animationConfig,
    variants: simpleVariants,
  };
}
