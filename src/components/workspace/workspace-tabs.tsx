"use client";

import type { ReactNode } from 'react';
import { TabButton } from './tab-button';
import { useWorkspace } from './workspace-context';
import { Layers3, Timer } from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';

interface EditorTabConfig {
  key: 'timeline' | 'canvas' | 'image' | 'audio';
  label: string;
  icon: ReactNode;
  requiredNodeType?: string;
}

const EDITOR_TABS: EditorTabConfig[] = [
  { key: 'timeline', label: 'Timeline', icon: <Timer size={16} />, requiredNodeType: 'animation' },
  { key: 'canvas', label: 'Canvas', icon: <ImageIcon size={16} />, requiredNodeType: 'canvas' },
  // future: image, audio
];

export function WorkspaceTabs() {
  const { state, updateUI } = useWorkspace();
  const { activeTab, selectedNodeId, selectedNodeType } = state.ui;

  const handleTabChange = (tabKey: 'flow' | 'timeline' | 'canvas' | 'image' | 'audio') => {
    updateUI({ activeTab: tabKey });
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabKey);
    if (selectedNodeId && tabKey !== 'flow') url.searchParams.set('node', selectedNodeId);
    else url.searchParams.delete('node');
    window.history.pushState({}, '', url.toString());
  };

  const getNodeDisplayName = (nodeId: string) => {
    const node = state.flow.nodes.find((n) => n.data.identifier.id === nodeId);
    return node?.data.identifier.displayName ?? 'Unknown';
  };

  return (
    <div className="flex items-center gap-1">
      <TabButton active={activeTab === 'flow'} onClick={() => handleTabChange('flow')} icon={<Layers3 size={16} />} label="Workspace" />
      {EDITOR_TABS.map((tab) => {
        const canShow = selectedNodeId && selectedNodeType === tab.requiredNodeType;
        if (!canShow) return null;
        const isActive = activeTab === tab.key;
        return (
          <TabButton
            key={tab.key}
            active={isActive}
            onClick={() => handleTabChange(tab.key)}
            icon={tab.icon}
            label={`${tab.label} (${getNodeDisplayName(selectedNodeId)})`}
            onClose={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}
          />
        );
      })}
    </div>
  );
}