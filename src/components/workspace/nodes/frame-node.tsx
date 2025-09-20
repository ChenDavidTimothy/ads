// src/components/workspace/nodes/frame-node.tsx - Frame output node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Image as ImageIcon } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { FrameNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function FrameNode({ data, selected }: NodeProps<FrameNodeData>) {
  const nodeDefinition = getNodeDefinition('frame');
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

  const resolutionLabel = getResolutionLabel(data.width || 1920, data.height || 1080);
  const formatLabel = (data.format || 'png').toUpperCase();

  return (
    <NodeCard selected={selected}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Image pipeline"
          description="Connect the flow you want to export as images."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<ImageIcon size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{formatLabel}</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Resolution</span>
          <span className="font-medium text-[var(--text-primary)]">
            {resolutionLabel} ({data.width || 1920}×{data.height || 1080})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Background</span>
          <span className="font-medium text-[var(--text-primary)]">
            {(data.backgroundColor || '#000000').toUpperCase()}
          </span>
        </div>
        {formatLabel === 'JPEG' ? (
          <div className="flex items-center justify-between">
            <span>Quality</span>
            <span className="font-medium text-[var(--text-primary)]">{data.quality ?? 90}</span>
          </div>
        ) : null}
        <div className="text-xs text-[var(--text-muted)]">
          Still image output
        </div>
      </div>
    </NodeCard>
  );
}
