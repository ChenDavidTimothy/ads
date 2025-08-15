"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  variant?: "default" | "glass" | "minimal";
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full text-[var(--text-primary)] text-[12px] text-refined transition-all",
          "duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
          "focus:outline-none focus:ring-1 focus:ring-[var(--ring-color)]",
          {
            "default": "bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]",
            "glass": "glass-input rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]",
            "minimal": "bg-transparent border-0 border-b border-[var(--border-primary)] rounded-none px-0 py-[var(--space-1)]"
          }[variant],
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";