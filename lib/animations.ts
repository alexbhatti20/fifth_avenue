/**
 * Shared animation variants and utilities for consistent animations across the app
 */

// Fade in animations
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

// Slide up animations
export const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 25 }
  }
};

// Slide from left
export const slideLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 25 }
  }
};

// Scale in
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 25 }
  }
};

// Stagger container for lists
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

// Card hover effect
export const cardHover = {
  scale: 1.05,
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.2)",
  transition: { type: "spring", stiffness: 400, damping: 25 }
};

// Gentle card hover
export const gentleCardHover = {
  scale: 1.02,
  boxShadow: "0 15px 40px rgba(0, 0, 0, 0.15)",
  transition: { type: "spring", stiffness: 300, damping: 20 }
};

// Float animation keyframes
export const float = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Pulse animation
export const pulse = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Shimmer effect for loading
export const shimmer = {
  animate: {
    x: ['-100%', '200%'],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// Gradient animation
export const gradientShift = {
  animate: {
    x: ['-100%', '100%'],
    transition: {
      duration: 5,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// Bounce animation
export const bounce = {
  animate: {
    y: [0, -20, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: "easeOut"
    }
  }
};

// Rotate animation (for loading spinners)
export const rotate = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// Exit animations
export const exitSlideRight = {
  opacity: 0,
  x: 20,
  transition: { duration: 0.3 }
};

export const exitFade = {
  opacity: 0,
  transition: { duration: 0.2 }
};

export const exitScale = {
  opacity: 0,
  scale: 0.9,
  transition: { duration: 0.2 }
};

// Page transitions
export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 }
};

// Modal transitions
export const modalTransition = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2 }
};

// Utility function to create stagger effect
export const createStagger = (staggerDelay: number = 0.1, delayChildren: number = 0) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren
    }
  }
});

// Utility function for delayed animations
export const createDelayedAnimation = (delay: number) => ({
  ...slideUp,
  visible: {
    ...slideUp.visible,
    transition: {
      ...slideUp.visible.transition,
      delay
    }
  }
});
