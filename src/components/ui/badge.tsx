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
					"rounded-[var(--radius-sm)] text-[10px] border border-[var(--border-primary)]",
					{
						"default": "text-[var(--text-tertiary)] bg-transparent",
						"manual": "text-[var(--warning-600)] bg-transparent",
						"bound": "text-[var(--node-data)] bg-transparent",
						"result": "text-[var(--text-primary)] bg-[var(--node-output)] border-transparent",
					}[variant],
					className
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
						className="ml-1 hover:bg-black/10 rounded-sm p-0.5 transition-colors"
						title="Reset to default"
					>
						<X size={8} />
					</button>
				)}
			</span>
		);
	}
);

Badge.displayName = "Badge";