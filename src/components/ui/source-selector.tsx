"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AutoToggleProps {
	active: boolean;
	onToggle: (next: boolean) => void;
	className?: string;
	label?: string;
}

export function AutoToggle({ active, onToggle, className, label = "Auto" }: AutoToggleProps) {
	return (
		<button
			type="button"
			className={cn(
				"rounded px-2 py-0.5 text-xs",
				active
					? "bg-[var(--surface-3)] text-[var(--accent-primary)] border border-[var(--accent-primary)]"
					: "bg-[var(--surface-2)] text-[var(--text-tertiary)] border border-[var(--border-primary)]",
				className,
			)}
			onClick={() => onToggle(!active)}
		>
			{label}
		</button>
	);
}