'use client';

import { useWorkspace } from './workspace-context';
import { FlowEditorTab } from '@/components/workspace/flow-editor-tab';
import { TimelineEditorTab } from '@/components/workspace/timeline-editor-tab';
import { CanvasEditorTab } from '@/components/workspace/canvas';
import { TypographyEditorTab } from '@/components/workspace/typography';
import { MediaEditorTab } from '@/components/workspace/media';

export function WorkspaceTabContent() {
  const { state } = useWorkspace();
  const { activeTab, selectedNodeId, selectedNodeType } = state.ui;

  switch (activeTab) {
    case 'timeline':
      if (!selectedNodeId || selectedNodeType !== 'animation') {
        return (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
            No animation node selected
          </div>
        );
      }
      return <TimelineEditorTab nodeId={selectedNodeId} />;
    case 'canvas':
      if (!selectedNodeId || selectedNodeType !== 'canvas') {
        return (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
            No canvas node selected
          </div>
        );
      }
      return <CanvasEditorTab nodeId={selectedNodeId} />;
    case 'typography':
      if (!selectedNodeId || selectedNodeType !== 'typography') {
        return (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
            No Typography node selected
          </div>
        );
      }
      return <TypographyEditorTab nodeId={selectedNodeId} />;
    case 'media':
      if (!selectedNodeId || selectedNodeType !== 'media') {
        return (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
            No Media node selected
          </div>
        );
      }
      return <MediaEditorTab nodeId={selectedNodeId} />;
    case 'flow':
    default:
      return <FlowEditorTab />;
  }
}
