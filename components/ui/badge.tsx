import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-none border-2 border-black px-2 py-0 text-[10px] sm:px-2.5 sm:text-xs font-bebas tracking-widest uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
  {
    variants: {
      variant: {
        default: "bg-[#FFD200] text-black hover:bg-[#FFD200]/90",
        secondary: "bg-black text-white hover:bg-black/90",
        destructive: "bg-[#ED1C24] text-white hover:bg-[#ED1C24]/90",
        outline: "bg-white text-black",
        success: "bg-[#008A45] text-white hover:bg-[#008A45]/90",
        warning: "bg-[#FF8A00] text-white hover:bg-[#FF8A00]/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
