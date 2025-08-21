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
          "text-refined w-full text-[12px] text-[var(--text-primary)] transition-all",
          "duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
          "focus:ring-1 focus:ring-[var(--ring-color)] focus:outline-none",
          {
            default:
              "rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)]",
            glass:
              "glass-input rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]",
            minimal:
              "rounded-none border-0 border-b border-[var(--border-primary)] bg-transparent px-0 py-[var(--space-1)]",
          }[variant],
          props.disabled ? "opacity-60" : undefined,
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
