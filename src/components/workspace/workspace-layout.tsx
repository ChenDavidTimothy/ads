"use client";

import { useSearchParams } from 'next/navigation';
import { WorkspaceProvider } from './workspace-context';
import { WorkspaceHeader } from './workspace-header';
import { WorkspaceTabContent } from './workspace-tab-content';

export function WorkspaceLayout({ workspaceId }: { workspaceId: string }) {
	const searchParams = useSearchParams();
	const initialTab = (searchParams.get('tab') as 'flow' | 'timeline' | 'canvas' | 'image' | 'audio') || 'flow';
	const initialNodeId = searchParams.get('node');

	return (
		<WorkspaceProvider workspaceId={workspaceId}>
			<div className="h-screen flex flex-col bg-[var(--surface-0)]">
				<WorkspaceHeader />
				<div className="flex-1 overflow-hidden flex flex-col">
					<WorkspaceTabContent />
				</div>
			</div>
		</WorkspaceProvider>
	);
}