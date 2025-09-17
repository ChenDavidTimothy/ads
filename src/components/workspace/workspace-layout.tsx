'use client';

import { WorkspaceProvider } from './workspace-context';
import { WorkspaceHeader } from './workspace-header';
import { WorkspaceTabContent } from './workspace-tab-content';

export function WorkspaceLayout({ workspaceId }: { workspaceId: string }) {
  return (
    <WorkspaceProvider workspaceId={workspaceId}>
      <div className="flex h-screen flex-col bg-[var(--surface-0)]">
        <WorkspaceHeader />
        <div className="flex-1 overflow-hidden">
          <WorkspaceTabContent />
        </div>
      </div>
    </WorkspaceProvider>
  );
}
