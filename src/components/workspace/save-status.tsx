"use client";

import { cn } from '@/lib/utils';
import { CheckCircle2, Clock4, HardDriveDownload, WifiOff, AlertTriangle } from 'lucide-react';

interface SaveStatusProps {
	lastSaved: Date | null;
	hasUnsavedChanges: boolean;
	isSaving: boolean;
	isOnline?: boolean;
	hasBackup?: boolean;
	hasMultipleTabs?: boolean;
}

export function SaveStatus({ lastSaved, hasUnsavedChanges, isSaving, isOnline = true, hasBackup = false, hasMultipleTabs = false }: SaveStatusProps) {
	const status = (() => {
		if (!isOnline) return { icon: WifiOff, label: 'Offline', className: 'text-[var(--warning-600)]' };
		    if (isSaving) return { icon: HardDriveDownload, label: 'Saving…', className: 'text-[var(--accent-primary)] animate-pulse' };
		if (hasUnsavedChanges) return { icon: Clock4, label: 'Unsaved changes', className: 'text-[var(--warning-600)]' };
		return { icon: CheckCircle2, label: lastSaved ? `Saved ${formatAgo(lastSaved)}` : 'Saved', className: 'text-[var(--success-500)]' };
	})();

	const Icon = status.icon;

	return (
		<div className={cn('flex items-center gap-2 text-sm', status.className)} title={tooltip({ lastSaved, hasBackup, hasMultipleTabs, isOnline, hasUnsavedChanges })}>
			<Icon size={16} />
			<span className="whitespace-nowrap">{status.label}</span>
			{hasBackup && <span className="ml-1 text-xs text-[var(--text-tertiary)]">(backup)</span>}
			{hasMultipleTabs && <span className="ml-2 text-[var(--warning-600)] flex items-center gap-1"><AlertTriangle size={14} /> Multi-tab</span>}
		</div>
	);
}

function formatAgo(date: Date): string {
	const diff = Date.now() - date.getTime();
	const sec = Math.floor(diff / 1000);
	if (sec < 60) return 'just now';
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const d = Math.floor(hr / 24);
	return `${d}d ago`;
}

function tooltip(args: { lastSaved: Date | null; hasBackup: boolean; hasMultipleTabs: boolean; isOnline: boolean; hasUnsavedChanges: boolean }): string {
	const parts: string[] = [];
	if (!args.isOnline) parts.push('Offline');
	if (args.hasUnsavedChanges) parts.push('Unsaved changes');
	if (args.lastSaved) parts.push(`Last saved: ${args.lastSaved.toLocaleString()}`);
	if (args.hasBackup) parts.push('Local backup available');
	if (args.hasMultipleTabs) parts.push('Multiple tabs detected');
	return parts.join(' • ');
}