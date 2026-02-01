import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-10 sm:h-10 w-full rounded-lg border border-input bg-background px-3 py-2",
          // Text sizing - 16px on mobile to prevent iOS zoom, smaller on desktop
          "text-base sm:text-sm",
          // Ring and focus styles
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 focus-visible:border-primary/50",
          // File input styles
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Placeholder
          "placeholder:text-muted-foreground/70",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Transition
          "transition-colors duration-200",
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
