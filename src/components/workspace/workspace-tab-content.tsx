"use client";

import { useWorkspace } from './workspace-context';
import { FlowEditor } from '@/components/workspace/flow-editor';

export function WorkspaceTabContent() {
  const { state } = useWorkspace();
  const { activeTab } = state.ui;

  switch (activeTab) {
    case 'flow':
    default:
      return <FlowEditor />;
  }
}