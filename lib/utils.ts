import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mobile detection utility
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

// Reduce motion preference check
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Check if heavy animations should be disabled (mobile or reduced motion)
export function shouldReduceAnimations(): boolean {
  if (typeof window === 'undefined') return true;
  return isMobile() || prefersReducedMotion();
}

// Get optimized animation config based on device
export function getAnimationConfig() {
  const mobile = isMobile();
  const reducedMotion = prefersReducedMotion();
  const shouldReduce = mobile || reducedMotion;
  
  return {
    enabled: !reducedMotion,
    // Disable heavy animations on mobile completely
    heavyAnimationsEnabled: !shouldReduce,
    duration: shouldReduce ? 0.15 : 0.5,
    stagger: shouldReduce ? 0.02 : 0.1,
    spring: shouldReduce 
      ? { stiffness: 500, damping: 40 } 
      : { stiffness: 300, damping: 25 },
  };
}

// Get simplified motion variants for mobile
export function getMobileOptimizedVariants(desktopVariants: Record<string, unknown>) {
  if (typeof window === 'undefined') return desktopVariants;
  
  if (shouldReduceAnimations()) {
    // Return simplified variants without heavy transforms
    return {
      hidden: { opacity: 0 },
      visible: { 
        opacity: 1,
        transition: { duration: 0.15 }
      }
    };
  }
  
  return desktopVariants;
}
