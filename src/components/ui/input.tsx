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
          "text-refined w-full text-[12px] text-[var(--text-primary)] transition-all cursor-text",
          "duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
          "placeholder:text-[var(--text-muted)]",
          {
            default:
              "rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.1)] px-[var(--space-3)] py-[var(--space-2)] backdrop-blur-[12px]",
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
        style={{
          ...(variant === "default" && {
            background: `
              linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, transparent 40%, rgba(59, 130, 246, 0.01) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.02), transparent),
              rgba(8, 8, 15, 0.85)
            `,
            boxShadow:
              "inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)",
          }),
        }}
        onFocus={(e) => {
          if (variant === "default" && !error) {
            e.currentTarget.style.background = `
              linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 35%, rgba(139, 92, 246, 0.02) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent),
              rgba(12, 12, 22, 0.9)
            `;
            e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
            e.currentTarget.style.boxShadow =
              "inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(139, 92, 246, 0.15), 0 0 24px rgba(139, 92, 246, 0.08)";
          }
        }}
        onBlur={(e) => {
          if (variant === "default" && !error) {
            e.currentTarget.style.background = `
              linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, transparent 40%, rgba(59, 130, 246, 0.01) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.02), transparent),
              rgba(8, 8, 15, 0.85)
            `;
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.boxShadow =
              "inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)";
          }
        }}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
