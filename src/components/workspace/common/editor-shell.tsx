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
			<div className="h-12 px-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/60">
				<div className="flex items-center gap-3">
					<div className="text-white font-medium">{title}</div>
					{headerExtras}
				</div>
				{onBack && (
					<button className="text-sm text-gray-300 hover:text-white" onClick={onBack}>Back to Flow</button>
				)}
			</div>
			<div className="flex-1 flex">
				{left}
				{center}
				{right !== undefined && (
					<div className="w-80 border-l border-gray-600 p-4 bg-gray-850">
						{rightHeader}
						{right}
					</div>
				)}
			</div>
		</div>
	);
}