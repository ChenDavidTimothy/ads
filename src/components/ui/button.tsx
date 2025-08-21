"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "glass"
    | "minimal"
    | "danger"
    | "success"
    | "ghost";
  interaction?: "always" | "hover" | "conditional"; // New interaction control
  size?: "xs" | "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      interaction = "always",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "text-refined-medium inline-flex items-center justify-center font-medium transition-all",
          "duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
          "focus:ring-1 focus:ring-[var(--ring-color)] focus:ring-offset-1 focus:ring-offset-[var(--surface-0)] focus:outline-none",
          "rounded-[var(--radius-sm)] disabled:cursor-not-allowed disabled:opacity-40",
          // Ultra-compact sizing
          {
            xs: "h-6 px-[var(--space-2)] py-[var(--space-half)] text-[10px]",
            sm: "h-7 px-[var(--space-3)] py-[var(--space-1)] text-[11px]",
            md: "h-8 px-[var(--space-4)] py-[var(--space-2)] text-[12px]",
            lg: "h-9 px-[var(--space-5)] py-[var(--space-3)] text-[13px]",
          }[size],
          // Refined variants
          {
            primary:
              "border border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110",
            secondary:
              "border border-[var(--border-primary)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)]",
            glass: "glass-button text-[var(--text-primary)]",
            minimal:
              "border border-transparent bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
            danger:
              "border border-[var(--danger-600)] bg-[var(--danger-600)] text-[var(--text-primary)] hover:bg-[var(--danger-700)]",
            success:
              "border border-[var(--success-600)] bg-[var(--success-600)] text-[var(--text-primary)] hover:bg-[var(--success-700)]",
            ghost:
              "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--button-ghost-hover)] hover:text-[var(--text-primary)]",
          }[variant],
          // Interaction state classes
          {
            always: "",
            hover: "opacity-0 transition-opacity group-hover:opacity-100",
            conditional:
              "data-[show=false]:opacity-0 data-[show=true]:opacity-100",
          }[interaction || "always"],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
