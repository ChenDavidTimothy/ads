"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "glass" | "minimal" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all text-refined-medium",
          "duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
          "focus:outline-none focus:ring-1 focus:ring-[var(--ring-color)] focus:ring-offset-1 focus:ring-offset-[var(--surface-0)]",
          "disabled:opacity-40 disabled:cursor-not-allowed rounded-[var(--radius-sm)]",
          // Ultra-compact sizing
          {
            "xs": "px-[var(--space-2)] py-[var(--space-half)] text-[10px] h-6",
            "sm": "px-[var(--space-3)] py-[var(--space-1)] text-[11px] h-7",
            "md": "px-[var(--space-4)] py-[var(--space-2)] text-[12px] h-8",
            "lg": "px-[var(--space-5)] py-[var(--space-3)] text-[13px] h-9",
          }[size],
          // Refined variants
          {
            "primary": "bg-[var(--accent-600)] text-[var(--text-primary)] hover:bg-[var(--accent-700)] border border-[var(--accent-600)]",
            "secondary": "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)] border border-[var(--border-primary)]",
            "glass": "glass-button text-[var(--text-primary)]",
            "minimal": "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] border border-transparent",
            "danger": "bg-[var(--danger-600)] text-[var(--text-primary)] hover:bg-[var(--danger-700)] border border-[var(--danger-600)]"
          }[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";