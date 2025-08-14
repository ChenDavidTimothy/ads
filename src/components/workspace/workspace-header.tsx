"use client";

import { WorkspaceTabs } from './workspace-tabs';
import { useWorkspace } from './workspace-context';
import { SaveStatus } from './save-status';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useMultiTabDetection } from '@/hooks/use-multi-tab-detection';
import { Button } from '@/components/ui/button';
import { PanelLeft, PanelRight, ArrowLeft } from 'lucide-react';
import { AuthStatus } from '@/components/auth/auth-status';
import Link from 'next/link';

export function WorkspaceHeader() {
	const { state, isSaving, hasUnsavedChanges, lastSaved, hasBackup, updateUI } = useWorkspace();
	const isOnline = useOnlineStatus();
	const { hasMultipleTabs } = useMultiTabDetection(state.meta.workspaceId);

	return (
		<div className="h-14 bg-[var(--surface-1)] border-b border-[var(--border-primary)] flex items-center justify-between px-[var(--space-4)] gap-[var(--space-4)]">
			<div className="flex items-center gap-[var(--space-2)] min-w-0">
				<Link href="/workspace-selector" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
					<ArrowLeft size={16} />
				</Link>
				<Button
					variant="ghost"
					size="sm"
					aria-label="Toggle left sidebar"
					onClick={() => updateUI({ leftSidebarCollapsed: !state.ui.leftSidebarCollapsed })}
				>
					<PanelLeft size={16} />
				</Button>
				<WorkspaceTabs />
				<div className="ml-[var(--space-3)] truncate text-[var(--text-secondary)] max-w-[360px]">{state.meta.name}</div>
			</div>
			<div className="flex items-center gap-[var(--space-4)]">
				<SaveStatus
					lastSaved={lastSaved}
					hasUnsavedChanges={hasUnsavedChanges}
					isSaving={isSaving}
					isOnline={isOnline}
					hasBackup={hasBackup}
					hasMultipleTabs={hasMultipleTabs}
				/>
				<AuthStatus />
				<Button
					variant="ghost"
					size="sm"
					aria-label="Toggle right sidebar"
					onClick={() => updateUI({ rightSidebarCollapsed: !state.ui.rightSidebarCollapsed })}
				>
					<PanelRight size={16} />
				</Button>
			</div>
		</div>
	);
}