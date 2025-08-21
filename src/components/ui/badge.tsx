"use client";

import { forwardRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "manual" | "bound" | "result";
  onRemove?: () => void;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, onRemove, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 px-[var(--space-2)] py-[var(--space-half)]",
          "rounded-[var(--radius-sm)] border border-[var(--border-primary)] text-[10px]",
          {
            default: "bg-transparent text-[var(--text-tertiary)]",
            manual: "bg-transparent text-[var(--warning-600)]",
            bound: "bg-transparent text-[var(--node-data)]",
            result:
              "border-transparent bg-[var(--node-output)] text-[var(--text-primary)]",
          }[variant],
          className,
        )}
        {...props}
      >
        {children}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-1 rounded-sm p-0.5 transition-colors hover:bg-black/10"
            title="Reset to default"
          >
            <X size={8} />
          </button>
        )}
      </span>
    );
  },
);

Badge.displayName = "Badge";
