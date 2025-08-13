"use client";

import { WorkspaceTabs } from './workspace-tabs';
import { useWorkspace } from './workspace-context';
import { SaveStatus } from './save-status';
import { SaveButton } from './save-button';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useMultiTabDetection } from '@/hooks/use-multi-tab-detection';
import { Button } from '@/components/ui/button';
import { PanelLeft, PanelRight } from 'lucide-react';
import { AuthStatus } from '@/components/auth/auth-status';

export function WorkspaceHeader() {
	const { state, saveNow, isSaving, hasUnsavedChanges, lastSaved, hasBackup, updateUI } = useWorkspace();
	const isOnline = useOnlineStatus();
	const { hasMultipleTabs } = useMultiTabDetection(state.meta.workspaceId);

	return (
		<div className="h-14 bg-[var(--surface-1)] border-b border-[var(--border-primary)] flex items-center justify-between px-4">
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					aria-label="Toggle left sidebar"
					onClick={() => updateUI({ leftSidebarCollapsed: !state.ui.leftSidebarCollapsed })}
				>
					<PanelLeft size={16} />
				</Button>
				<WorkspaceTabs />
			</div>
			<h1 className="text-lg font-semibold text-[var(--text-primary)] truncate max-w-[300px]">{state.meta.name}</h1>
			<div className="flex items-center gap-3">
				<AuthStatus />
				<SaveStatus
					lastSaved={lastSaved}
					hasUnsavedChanges={hasUnsavedChanges}
					isSaving={isSaving}
					isOnline={isOnline}
					hasBackup={hasBackup}
					hasMultipleTabs={hasMultipleTabs}
				/>
				<SaveButton onSave={() => void saveNow()} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} disabled={!isOnline} />
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