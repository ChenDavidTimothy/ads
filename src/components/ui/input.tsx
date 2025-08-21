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
          "text-refined w-full text-[12px] text-[var(--text-primary)] transition-all",
          "duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
          "placeholder:text-[var(--text-muted)]",
          {
            default:
              "rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)]",
            glass:
              "glass-input rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]",
            minimal:
              "rounded-none border-0 border-b border-[var(--border-primary)] bg-transparent px-0 py-[var(--space-1)]",
          }[variant],
          error
            ? "border-[var(--danger-500)] focus:ring-1 focus:ring-[var(--danger-500)] focus:outline-none"
            : "focus:ring-1 focus:ring-[var(--ring-color)] focus:outline-none",
          props.disabled ? "opacity-60" : undefined,
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
