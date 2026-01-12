import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        default: "text-foreground",
        gradient: "bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 bg-clip-text text-transparent animate-gradient-x",
        gradientSubtle: "bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent",
        gradientDark: "bg-gradient-to-r from-red-700 via-red-500 to-rose-600 bg-clip-text text-transparent",
        glow: "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] hover:drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]",
        neon: "text-red-400 animate-pulse drop-shadow-[0_0_10px_rgba(248,113,113,0.8)]",
        fire: "bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 bg-clip-text text-transparent animate-gradient-x",
      },
      size: {
        default: "text-sm",
        xs: "text-xs",
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg font-semibold",
        xl: "text-xl font-bold",
      },
      animation: {
        none: "",
        pulse: "animate-pulse",
        bounce: "animate-bounce",
        shimmer: "animate-shimmer",
        float: "animate-float",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      animation: "none",
    },
  }
);

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  required?: boolean;
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, variant, size, animation, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants({ variant, size, animation }), className)}
    {...props}
  >
    {children}
    {required && (
      <span className="ml-1 text-red-500 animate-pulse">*</span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label, labelVariants };
