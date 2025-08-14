"use client";

import React from 'react';

interface EditorShellProps {
	title: string;
	left: React.ReactNode;
	center: React.ReactNode;
	right?: React.ReactNode;
	rightHeader?: React.ReactNode;
	onBack?: () => void;
	headerExtras?: React.ReactNode;
}

export function EditorShell({ title, left, center, right, rightHeader, onBack, headerExtras }: EditorShellProps) {
	return (
		<div className="h-full flex flex-col">
			<div className="h-12 px-4 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--surface-1)]/60">
				<div className="flex items-center gap-3">
					<div className="text-[var(--text-primary)] font-medium">{title}</div>
					{headerExtras}
				</div>
				{onBack && (
					<button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onClick={onBack}>Back to Flow</button>
				)}
			</div>
			<div className="flex-1 flex">
				{left}
				{center}
				{right !== undefined && (
					<div className="w-80 border-l border-[var(--border-primary)] p-4 bg-[var(--surface-2)]">
						{rightHeader}
						{right}
					</div>
				)}
			</div>
		</div>
	);
}