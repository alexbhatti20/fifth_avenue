"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MOBILE_BREAKPOINT = 768;
const FPS_THRESHOLD = 30; // If FPS drops below this, reduce animations
const LAG_SAMPLE_SIZE = 10; // Number of frames to sample for lag detection
const LOW_MEMORY_THRESHOLD = 4; // GB - devices with less RAM are considered low-end

/**
 * Hook to detect if heavy animations should be reduced
 * Auto-detects:
 * - Mobile devices
 * - User prefers reduced motion
 * - Low hardware (memory, CPU cores)
 * - Runtime lag detection (FPS monitoring)
 */
export function useReducedMotion() {
  const [shouldReduce, setShouldReduce] = useState(true); // Default to reduced for SSR
  const [isLowHardware, setIsLowHardware] = useState(false);
  const [isLagging, setIsLagging] = useState(false);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const lagDetectedRef = useRef(false);

  // Detect low hardware on mount
  useEffect(() => {
    const detectLowHardware = () => {
      // Check device memory (if available)
      const deviceMemory = (navigator as any).deviceMemory;
      if (deviceMemory && deviceMemory < LOW_MEMORY_THRESHOLD) {
        return true;
      }

      // Check CPU cores
      const hardwareConcurrency = navigator.hardwareConcurrency;
      if (hardwareConcurrency && hardwareConcurrency <= 2) {
        return true;
      }

      // Check if it's a mobile device with touch
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      
      // Mobile touch devices are often lower powered
      if (isTouchDevice && isMobile) {
        return true;
      }

      // Check connection speed (slow connection often means low-end device)
      const connection = (navigator as any).connection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          return true;
        }
        // Save data mode usually indicates resource constraints
        if (connection.saveData) {
          return true;
        }
      }

      return false;
    };

    setIsLowHardware(detectLowHardware());
  }, []);

  // FPS monitoring for lag detection
  useEffect(() => {
    // Don't monitor if already reduced
    if (isLowHardware) {
      setIsLagging(false);
      return;
    }

    let consecutiveLowFrames = 0;
    const LOW_FRAME_THRESHOLD = 5; // Number of consecutive low FPS frames to trigger

    const measureFPS = (timestamp: number) => {
      if (lastFrameTimeRef.current) {
        const delta = timestamp - lastFrameTimeRef.current;
        const fps = 1000 / delta;

        frameTimesRef.current.push(fps);
        if (frameTimesRef.current.length > LAG_SAMPLE_SIZE) {
          frameTimesRef.current.shift();
        }

        // Calculate average FPS
        if (frameTimesRef.current.length >= LAG_SAMPLE_SIZE) {
          const avgFPS = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
          
          if (avgFPS < FPS_THRESHOLD) {
            consecutiveLowFrames++;
            if (consecutiveLowFrames >= LOW_FRAME_THRESHOLD && !lagDetectedRef.current) {
              lagDetectedRef.current = true;
              setIsLagging(true);
              // Once lag is detected, stop monitoring to save resources
              if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
              }
              return;
            }
          } else {
            consecutiveLowFrames = 0;
          }
        }
      }

      lastFrameTimeRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(measureFPS);
    };

    // Start monitoring after a short delay to let page settle
    const timeoutId = setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(measureFPS);
    }, 1000);

    // Stop monitoring after 10 seconds if no lag detected
    const stopMonitoringTimeout = setTimeout(() => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(stopMonitoringTimeout);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLowHardware]);

  // Combine all factors
  useEffect(() => {
    const checkMobile = () => window.innerWidth < MOBILE_BREAKPOINT;
    const checkReducedMotion = () => 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    const updateState = () => {
      const shouldReduceMotion = 
        checkMobile() || 
        checkReducedMotion() || 
        isLowHardware || 
        isLagging;
      
      setShouldReduce(shouldReduceMotion);
    };

    updateState();

    const handleResize = () => updateState();
    window.addEventListener('resize', handleResize);
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', updateState);

    return () => {
      window.removeEventListener('resize', handleResize);
      mediaQuery.removeEventListener('change', updateState);
    };
  }, [isLowHardware, isLagging]);

  return shouldReduce;
}

/**
 * Extended hook that provides more detailed performance info
 */
export function usePerformanceMode() {
  const shouldReduce = useReducedMotion();
  const [performanceLevel, setPerformanceLevel] = useState<'high' | 'medium' | 'low'>('low');

  useEffect(() => {
    const detectPerformanceLevel = (): 'high' | 'medium' | 'low' => {
      // High performance: Desktop with good hardware
      const deviceMemory = (navigator as any).deviceMemory;
      const cores = navigator.hardwareConcurrency;
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) return 'low';
      
      if (!isMobile && deviceMemory >= 8 && cores >= 4) {
        return 'high';
      }
      
      if (!isMobile && (deviceMemory >= 4 || cores >= 4)) {
        return 'medium';
      }
      
      return 'low';
    };

    setPerformanceLevel(detectPerformanceLevel());
  }, []);

  return {
    shouldReduce,
    performanceLevel,
    // Helpers for conditional rendering
    canUseWebGL: !shouldReduce && performanceLevel === 'high',
    canUseParallax: !shouldReduce && performanceLevel !== 'low',
    canUseComplexAnimations: !shouldReduce,
  };
}

/**
 * Hook that provides animation variants optimized for performance
 * Heavy animations are disabled on low-end devices
 */
export function useOptimizedAnimations() {
  const { shouldReduce, performanceLevel } = usePerformanceMode();

  const animationConfig = {
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
  };

  // Simplified variants for low-end devices
  const simpleVariants = {
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
  };

  return {
    shouldReduce,
    performanceLevel,
    config: animationConfig,
    variants: simpleVariants,
  };
}
