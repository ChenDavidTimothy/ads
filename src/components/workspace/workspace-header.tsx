"use client";

import { WorkspaceTabs } from './workspace-tabs';
import { useWorkspace } from './workspace-context';
import { SaveStatus } from './save-status';
import { SaveButton } from './save-button';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useMultiTabDetection } from '@/hooks/use-multi-tab-detection';

export function WorkspaceHeader() {
  const { state, saveNow, isSaving, hasUnsavedChanges, lastSaved, hasBackup } = useWorkspace();
  const isOnline = useOnlineStatus();
  const { hasMultipleTabs } = useMultiTabDetection(state.meta.workspaceId);

  return (
    <div className="h-14 bg-gray-800 border-b border-gray-600 flex items-center justify-between px-4">
      <WorkspaceTabs />
      <h1 className="text-lg font-semibold text-white truncate max-w-[300px]">{state.meta.name}</h1>
      <div className="flex items-center gap-3">
        <SaveStatus
          lastSaved={lastSaved}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          isOnline={isOnline}
          hasBackup={hasBackup}
          hasMultipleTabs={hasMultipleTabs}
        />
        <SaveButton onSave={() => void saveNow()} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} disabled={!isOnline} />
      </div>
    </div>
  );
}