"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "glass" | "minimal" | "danger" | "success" | "ghost";
  interaction?: "always" | "hover" | "conditional";  // New interaction control
  size?: "xs" | "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", interaction = "always", children, ...props }, ref) => {
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
            "primary": "bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110 border border-[var(--accent-primary)]",
            "secondary": "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)] border border-[var(--border-primary)]",
            "glass": "glass-button text-[var(--text-primary)]",
            "minimal": "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] border border-transparent",
            "danger": "bg-[var(--danger-600)] text-[var(--text-primary)] hover:bg-[var(--danger-700)] border border-[var(--danger-600)]",
            "success": "bg-[var(--success-600)] text-[var(--text-primary)] hover:bg-[var(--success-700)] border border-[var(--success-600)]",
            "ghost": "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--button-ghost-hover)] hover:text-[var(--text-primary)] border border-transparent"
          }[variant],
          // Interaction state classes
          {
            "always": "",
            "hover": "opacity-0 group-hover:opacity-100 transition-opacity",
            "conditional": "data-[show=true]:opacity-100 data-[show=false]:opacity-0"
          }[interaction || "always"],
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