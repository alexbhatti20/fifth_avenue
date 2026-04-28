import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-12 w-full rounded-none border-4 border-black bg-background px-4 py-2",
          // Text sizing - 16px on mobile to prevent iOS zoom, smaller on desktop
          "text-base sm:text-sm font-source-sans font-medium",
          // Ring and focus styles
          "focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[#FFD200] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus-visible:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
          // File input styles
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Placeholder
          "placeholder:text-muted-foreground/70 uppercase tracking-widest text-[10px]",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Transition
          "transition-all duration-200",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
