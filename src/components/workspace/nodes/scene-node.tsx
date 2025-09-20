// src/components/workspace/nodes/scene-node.tsx - Scene output node UI
'use client';

import type { NodeProps } from 'reactflow';
import { MonitorPlay } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { SceneNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function SceneNode({ data, selected }: NodeProps<SceneNodeData>) {
  const nodeDefinition = getNodeDefinition('scene');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const getResolutionLabel = (width: number, height: number) => {
    if (width === 1920 && height === 1080) return 'FHD';
    if (width === 1280 && height === 720) return 'HD';
    if (width === 3840 && height === 2160) return '4K';
    if (width === 1080 && height === 1080) return 'Square';
    return 'Custom';
  };

  const resolutionLabel = getResolutionLabel(data.width, data.height);

  return (
    <NodeCard selected={selected}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Final render"
          description="Connect the animation pipeline you want to export."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<MonitorPlay size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={
          <span className="text-xs text-[var(--text-secondary)]">
            {data.duration}s • {data.fps}fps
          </span>
        }
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Resolution</span>
          <span className="font-medium text-[var(--text-primary)]">
            {resolutionLabel} ({data.width}×{data.height})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Background</span>
          <span className="font-medium text-[var(--text-primary)]">
            {data.backgroundColor.toUpperCase()}
          </span>
        </div>
        <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[11px]">
          Configure quality and preset options here before exporting your final video.
        </div>
      </div>
    </NodeCard>
  );
}
