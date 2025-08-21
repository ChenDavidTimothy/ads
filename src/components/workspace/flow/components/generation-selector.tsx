"use client";

import { SelectionList } from '@/components/ui/selection';
import { Badge } from '@/components/ui/badge';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { Node } from 'reactflow';
import type { NodeData } from '@/shared/types';

interface Props {
  sceneNodes: Node<NodeData>[];
  selectedSceneIds: string[];
  onToggleScene: (sceneId: string) => void;
  onSelectAllScenes: () => void;
  onSelectNoScenes: () => void;
  
  frameNodes: Node<NodeData>[];
  selectedFrameIds: string[];
  onToggleFrame: (frameId: string) => void;
  onSelectAllFrames: () => void;
  onSelectNoFrames: () => void;
}

export function GenerationSelector({
  sceneNodes,
  selectedSceneIds,
  onToggleScene,
  onSelectAllScenes,
  onSelectNoScenes,
  frameNodes,
  selectedFrameIds,
  onToggleFrame,
  onSelectAllFrames,
  onSelectNoFrames
}: Props) {
  
  const sceneItems = sceneNodes.map(node => ({
    id: node.data.identifier.id,
    label: node.data.identifier.displayName,
    icon: getNodeDefinition('scene')?.rendering.icon ?? '🎬'
  }));
  
  const frameItems = frameNodes.map(node => ({
    id: node.data.identifier.id,
    label: node.data.identifier.displayName,
    icon: getNodeDefinition('frame')?.rendering.icon ?? '🖼️'
  }));

  const hasScenes = sceneNodes.length > 0;
  const hasFrames = frameNodes.length > 0;
  const selectedTotal = selectedSceneIds.length + selectedFrameIds.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <Badge variant="default">
          {selectedTotal} selected
        </Badge>
        {selectedSceneIds.length > 0 && (
          <Badge variant="result">
            {selectedSceneIds.length} scene{selectedSceneIds.length !== 1 ? 's' : ''}
          </Badge>
        )}
        {selectedFrameIds.length > 0 && (
          <Badge variant="bound">
            {selectedFrameIds.length} frame{selectedFrameIds.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Scene Selection */}
      {hasScenes && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            🎬 Scenes ({sceneNodes.length})
          </h4>
          <SelectionList
            mode="multi"
            items={sceneItems}
            selectedIds={selectedSceneIds}
            onToggle={onToggleScene}
            onSelectAll={onSelectAllScenes}
            onSelectNone={onSelectNoScenes}
            emptyLabel="No scenes available"
          />
        </div>
      )}

      {/* Frame Selection */}
      {hasFrames && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            🖼️ Frames ({frameNodes.length})
          </h4>
          <SelectionList
            mode="multi"
            items={frameItems}
            selectedIds={selectedFrameIds}
            onToggle={onToggleFrame}
            onSelectAll={onSelectAllFrames}
            onSelectNone={onSelectNoFrames}
            emptyLabel="No frames available"
          />
        </div>
      )}

      {!hasScenes && !hasFrames && (
        <div className="text-sm text-[var(--text-tertiary)] text-center py-[var(--space-4)]">
          Add Scene or Frame nodes to enable selective generation
        </div>
      )}
    </div>
  );
}
