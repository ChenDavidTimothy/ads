"use client";

import { useSearchParams } from 'next/navigation';
import { WorkspaceProvider } from './workspace-context';
import { FlowEditor } from '@/components/workspace/flow-editor';

export function WorkspaceLayout({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const _initialTab = (searchParams.get('tab') as 'flow' | 'timeline' | 'image' | 'audio') || 'flow';
  const _initialNodeId = searchParams.get('node');

  return (
    <WorkspaceProvider workspaceId={workspaceId}>
      <div className="h-screen w-full bg-gray-900">
        {/* Temporarily render FlowEditor directly; tabs to be introduced in later phases */}
        <FlowEditor />
      </div>
    </WorkspaceProvider>
  );
}