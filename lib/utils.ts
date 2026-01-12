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

// Get optimized animation config based on device
export function getAnimationConfig() {
  const mobile = isMobile();
  const reducedMotion = prefersReducedMotion();
  
  return {
    enabled: !reducedMotion,
    duration: mobile ? 0.2 : 0.5,
    stagger: mobile ? 0.05 : 0.1,
    spring: mobile ? { stiffness: 400, damping: 30 } : { stiffness: 300, damping: 25 },
  };
}
