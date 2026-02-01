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

// =============================================
// UNIVERSAL ERROR HANDLING
// =============================================

// Check if error is related to network/internet connectivity
export function isNetworkError(error: unknown): boolean {
  // Empty error objects are typically network failures
  if (error && typeof error === 'object' && Object.keys(error).length === 0) {
    return true;
  }
  
  if (!error) return false;
  
  const errorStr = String(error).toLowerCase();
  const errorMessage = (error as Error)?.message?.toLowerCase() || '';
  const errorName = (error as Error)?.name?.toLowerCase() || '';
  
  const networkErrorPatterns = [
    'network',
    'fetch',
    'failed to fetch',
    'networkerror',
    'net::err',
    'econnrefused',
    'enotfound',
    'etimedout',
    'econnreset',
    'socket',
    'connection refused',
    'no internet',
    'offline',
    'unreachable',
    'dns',
    'timeout',
    'aborted',
    'load failed', // Safari network error
    'cancelled', // Request cancelled (often due to network)
  ];
  
  return networkErrorPatterns.some(pattern => 
    errorStr.includes(pattern) || 
    errorMessage.includes(pattern) || 
    errorName.includes(pattern)
  );
}

// Get user-friendly error message
export function getErrorMessage(error: unknown, context?: string): string {
  // Check for network/internet issues first
  if (isNetworkError(error)) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }
  
  // Handle empty error objects
  if (error && typeof error === 'object' && Object.keys(error).length === 0) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }
  
  // Extract error message if available
  const errorMessage = (error as Error)?.message || String(error);
  
  // Don't expose technical errors to users
  const technicalPatterns = [
    'rpc',
    'sql',
    'database',
    'supabase',
    'postgres',
    'function',
    'undefined',
    'null',
    'cannot read',
    'cannot access',
    'type error',
  ];
  
  const isTechnical = technicalPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern)
  );
  
  if (isTechnical) {
    return context 
      ? `Something went wrong while ${context}. Please try again.`
      : 'Something went wrong. Please try again.';
  }
  
  return errorMessage;
}

// Log error with context (for debugging) but return user-friendly message
export function handleError(error: unknown, context: string): string {
  // Log full error for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  }
  
  return getErrorMessage(error, context.toLowerCase());
}
