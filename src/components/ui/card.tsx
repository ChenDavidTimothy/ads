"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	selected?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
	({ className, selected, children, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					"bg-[var(--surface-2)] border rounded-[var(--radius-md)] transition-colors shadow-sm",
					selected ? "border-[var(--accent-500)] shadow-[0_0_0_1px_rgba(59,130,246,0.3)]" : "border-[var(--border-primary)]",
					className
				)}
				{...props}
			>
				{children}
			</div>
		);
	}
);

Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div ref={ref} className={cn("p-[var(--card-padding)] pb-[var(--space-2)]", className)} {...props} />
	)
);

CardHeader.displayName = "CardHeader";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div ref={ref} className={cn("p-[var(--card-padding)] pt-0", className)} {...props} />
	)
);

CardContent.displayName = "CardContent";