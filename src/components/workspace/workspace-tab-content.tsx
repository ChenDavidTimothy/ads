"use client";

import { useWorkspace } from './workspace-context';
import { FlowEditorTab } from '@/components/workspace/flow-editor-tab';
import { TimelineEditorTab } from '@/components/workspace/timeline-editor-tab';

export function WorkspaceTabContent() {
  const { state } = useWorkspace();
  const { activeTab, selectedNodeId, selectedNodeType } = state.ui;

  switch (activeTab) {
    case 'timeline':
      if (!selectedNodeId || selectedNodeType !== 'animation') {
        return <div className="h-full w-full flex items-center justify-center text-gray-300">No animation node selected</div>;
      }
      return <TimelineEditorTab nodeId={selectedNodeId} />;
    case 'flow':
    default:
      return <FlowEditorTab />;
  }
}