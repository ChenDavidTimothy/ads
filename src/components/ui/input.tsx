"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  variant?: "default" | "glass" | "minimal";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, variant = "default", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full text-[var(--text-primary)] text-[12px] text-refined transition-all",
          "duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
          "placeholder:text-[var(--text-muted)]",
          {
            "default": "bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]",
            "glass": "glass-input rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]",
            "minimal": "bg-transparent border-0 border-b border-[var(--border-primary)] rounded-none px-0 py-[var(--space-1)]"
          }[variant],
          error
            ? "border-[var(--danger-500)] focus:outline-none focus:ring-1 focus:ring-[var(--danger-500)]"
            : "focus:outline-none focus:ring-1 focus:ring-[var(--ring-color)]",
          props.disabled ? "opacity-60" : undefined,
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";