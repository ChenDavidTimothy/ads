"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
	size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "primary", size = "md", children, ...props }, ref) => {
		return (
			<button
				ref={ref}
				className={cn(
					"inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-all",
					"duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
					"focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)] focus:ring-offset-2 focus:ring-offset-[var(--surface-0)]",
					"disabled:opacity-50 disabled:cursor-not-allowed",
					// Size variants (tokenized)
					{
						"p-[var(--button-padding-sm)] text-[11px] font-medium": size === "sm",
						"p-[var(--button-padding-md)] text-[13px] font-medium": size === "md",
						"p-[var(--button-padding-lg)] text-[14px] font-medium": size === "lg",
					},
					// Color variants via semantic tokens
					{
						"bg-[var(--accent-500)] text-[var(--text-primary)] hover:bg-[var(--accent-600)] active:bg-[var(--accent-700)]": variant === "primary",
						"bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)] active:bg-[var(--surface-2)] border border-[var(--border-primary)]": variant === "secondary",
						"bg-[var(--success-500)] text-[var(--text-primary)] hover:bg-[var(--success-600)] active:bg-[var(--success-700)]": variant === "success",
						"bg-[var(--danger-500)] text-[var(--text-primary)] hover:bg-[var(--danger-600)]": variant === "danger",
						"text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]": variant === "ghost",
					},
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