"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, error, ...props }, ref) => {
		return (
			<input
				ref={ref}
				className={cn(
					"w-full rounded-[var(--radius-sm)] bg-[var(--surface-2)] border px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-primary)] text-sm",
					"placeholder:text-[var(--text-muted)] transition-all duration-[var(--duration-fast)] ease-[var(--easing-standard)]",
					error
						? "border-[var(--danger-500)] focus:outline-none focus:ring-2 focus:ring-[var(--danger-500)] focus:ring-offset-2 focus:ring-offset-[var(--surface-0)]"
						: "border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)] focus:ring-offset-2 focus:ring-offset-[var(--surface-0)]",
					className
				)}
				{...props}
			/>
		);
	}
);

Input.displayName = "Input";