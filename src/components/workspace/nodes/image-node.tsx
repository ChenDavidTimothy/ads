// src/components/workspace/nodes/image-node.tsx - Image input node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Image as ImageIcon } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { ImageNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const nodeDefinition = getNodeDefinition('image');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  return (
    <NodeCard selected={selected}>
      <NodeHeader
        icon={<ImageIcon size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">Library source</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[11px]">
          Drop this node to bring images from your asset library into the graph.
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Image stream"
          description="Emits the selected image for further processing."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
