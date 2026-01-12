import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-all duration-300",
  {
    variants: {
      variant: {
        default: "text-foreground",
        gradient: "bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-transparent animate-gradient-x tracking-wide",
        gradientSubtle: "bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent tracking-normal",
        fire: "bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 bg-clip-text text-transparent animate-gradient-x tracking-wider",
        glow: "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] tracking-wide",
        neon: "text-orange-400 animate-pulse drop-shadow-[0_0_10px_rgba(251,146,60,0.8)] tracking-widest",
      },
      size: {
        default: "text-sm",
        xs: "text-xs",
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg font-semibold",
        xl: "text-xl font-bold tracking-wider",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
>(({ className, variant, size, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants({ variant, size }), className)}
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
