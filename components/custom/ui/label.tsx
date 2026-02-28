import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-all duration-500 ease-out",
  {
    variants: {
      variant: {
        default: "text-foreground",
        
        // Sophisticated red gradient combinations
        gradient: "bg-gradient-to-r from-red-600 via-rose-500 to-pink-500 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]",
        gradientBold: "bg-gradient-to-r from-red-700 via-red-500 to-orange-500 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto] font-bold",
        gradientSubtle: "bg-gradient-to-r from-red-500/90 via-rose-400/90 to-pink-400/80 bg-clip-text text-transparent",
        gradientDark: "bg-gradient-to-r from-red-950 via-red-800 to-rose-700 bg-clip-text text-transparent",
        
        // Animated gradients matching landing page
        gradientFire: "bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]",
        gradientSunset: "bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]",
        gradientNeon: "bg-gradient-to-r from-rose-400 via-red-500 to-pink-600 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto] drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]",
        
        // Glowing effects
        glow: "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)] hover:drop-shadow-[0_0_16px_rgba(239,68,68,0.9)] transition-all duration-300",
        glowPulse: "text-red-500 animate-pulse drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]",
        glowIntense: "text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.9)] drop-shadow-[0_0_25px_rgba(248,113,113,0.5)]",
        
        // Premium variants
        premium: "bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent animate-shimmer bg-[length:200%_auto]",
        luxury: "bg-gradient-to-r from-yellow-600 via-amber-500 to-orange-400 bg-clip-text text-transparent font-semibold tracking-wide",
        
        // Brand color variants
        brand: "text-[hsl(352,82%,47%)] font-semibold",
        brandGlow: "text-[hsl(352,82%,47%)] drop-shadow-[0_0_10px_hsl(352,82%,47%,0.6)] font-semibold",
        
        // Multi-color advanced gradients
        rainbow: "bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent animate-gradient-x bg-[length:300%_auto]",
        warmth: "bg-gradient-to-br from-rose-600 via-red-500 to-orange-600 bg-clip-text text-transparent",
        heat: "bg-gradient-to-r from-red-600 via-orange-500 via-yellow-400 to-orange-500 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]",
      },
      size: {
        xs: "text-xs tracking-wide",
        sm: "text-sm tracking-wide",
        default: "text-sm tracking-wider",
        md: "text-base tracking-wider",
        lg: "text-lg font-semibold tracking-wider",
        xl: "text-xl font-bold tracking-widest",
        "2xl": "text-2xl font-bold tracking-widest",
      },
      animation: {
        none: "",
        pulse: "animate-pulse",
        bounce: "animate-bounce",
        shimmer: "animate-shimmer",
        float: "hover:translate-y-[-2px] transition-transform duration-300",
        glow: "hover:drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] transition-all duration-300",
        scale: "hover:scale-105 transition-transform duration-300",
      },
      spacing: {
        normal: "tracking-normal",
        wide: "tracking-wide",
        wider: "tracking-wider",
        widest: "tracking-widest",
        tight: "tracking-tight",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      animation: "none",
      spacing: "wider",
    },
  }
);

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  required?: boolean;
  glow?: boolean;
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, variant, size, animation, spacing, required, glow, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      labelVariants({ variant, size, animation, spacing }), 
      glow && "drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]",
      className
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="ml-1 text-red-500 animate-pulse font-bold">*</span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label, labelVariants };
