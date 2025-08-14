"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
	({ className, children, ...props }, ref) => {
		return (
			<select
				ref={ref}
				className={cn(
					"w-full rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] px-[var(--space-3)] py-[var(--space-2)] text-sm",
					"focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)] focus:ring-offset-2 focus:ring-offset-[var(--surface-0)] transition-all duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
					className
				)}
				{...props}
			>
				{children}
			</select>
		);
	}
);

Select.displayName = "Select";