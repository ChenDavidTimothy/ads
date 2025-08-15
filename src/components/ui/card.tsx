"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  variant?: "default" | "glass" | "minimal";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, selected, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "transition-all duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
          {
            // Default glass-like variant
            "default": "bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-[var(--radius-sm)]",
            // Ultra-glass variant  
            "glass": "glass-panel rounded-[var(--radius-sm)]",
            // Minimal variant
            "minimal": "bg-transparent border border-[var(--border-primary)] rounded-[var(--radius-sharp)]"
          }[variant],
          selected ? "border-[var(--accent-primary)] shadow-[0_0_0_1px_rgba(192,132,252,0.3)]" : "",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-[var(--card-padding-sm)] pb-[var(--space-1)]", className)} {...props} />
  )
);

CardHeader.displayName = "CardHeader";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-[var(--card-padding-sm)] pt-0", className)} {...props} />
  )
);

CardContent.displayName = "CardContent";