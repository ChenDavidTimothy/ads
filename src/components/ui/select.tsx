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
          "appearance-none bg-no-repeat",
          {
            default:
              "rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.1)] px-[var(--space-3)] py-[var(--space-2)] pr-10 backdrop-blur-[12px]",
            glass:
              "glass-input rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] pr-10",
            minimal:
              "rounded-none border-0 border-b border-[var(--border-primary)] bg-transparent px-0 py-[var(--space-1)] pr-6",
          }[variant],
          props.disabled ? "opacity-60" : undefined,
          className,
        )}
        style={{
          ...(variant === "default" && {
            background: `
              url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23cbd5e1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") right 8px center/16px 12px no-repeat,
              linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, transparent 40%, rgba(59, 130, 246, 0.01) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.02), transparent),
              rgba(8, 8, 15, 0.85)
            `,
            boxShadow:
              "inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)",
          }),
          ...(variant === "glass" && {
            backgroundImage:
              "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23cbd5e1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
            backgroundPosition: "right 8px center",
            backgroundSize: "16px 12px",
          }),
          ...(variant === "minimal" && {
            backgroundImage:
              "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23cbd5e1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
            backgroundPosition: "right 4px center",
            backgroundSize: "14px 10px",
          }),
        }}
        onFocus={(e) => {
          if (variant === "default") {
            e.currentTarget.style.background = `
              url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238b5cf6' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") right 8px center/16px 12px no-repeat,
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
          if (variant === "default") {
            e.currentTarget.style.background = `
              url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23cbd5e1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") right 8px center/16px 12px no-repeat,
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
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
