// src/components/workspace/nodes/media-node.tsx - Media processing node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Image, SlidersHorizontal } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { MediaNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

interface MediaNodeProps extends NodeProps<MediaNodeData> {
  onOpenMedia?: () => void;
}

export function MediaNode({ data, selected, onOpenMedia }: MediaNodeProps) {
  const nodeDefinition = getNodeDefinition('media');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const handleDoubleClick = () => {
    if (onOpenMedia) {
      onOpenMedia();
      return;
    }
    window.dispatchEvent(
      new CustomEvent('open-media-editor', {
        detail: { nodeId: data.identifier.id },
      })
    );
  };

  const currentAsset = data.imageAssetId ? 'Selected asset' : 'No asset yet';
  const cropInfo = data.cropWidth > 0 ? `${data.cropWidth}×${data.cropHeight}` : 'Full image';
  const displayInfo =
    data.displayWidth > 0 ? `${data.displayWidth}×${data.displayHeight}` : 'Auto fit';

  return (
    <NodeCard selected={selected} className="cursor-pointer" onDoubleClick={handleDoubleClick}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Image stream"
          description="Provide the image you want to edit."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<Image size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={
          <span className="flex items-center gap-[var(--space-1)] text-xs text-[var(--text-secondary)]">
            <SlidersHorizontal size={12} />
            {cropInfo}
          </span>
        }
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Asset</span>
          <span className="font-medium text-[var(--text-primary)]">{currentAsset}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Display</span>
          <span className="font-medium text-[var(--text-primary)]">{displayInfo}</span>
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Advanced media processing
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Processed image"
          description="Outputs the image with the configured adjustments."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
