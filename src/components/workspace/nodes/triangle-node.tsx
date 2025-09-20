// src/components/workspace/nodes/triangle-node.tsx - Simplified single output port

'use client';

import type { NodeProps } from 'reactflow';
import { Triangle as TriangleIcon } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TriangleNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function TriangleNode({ data, selected }: NodeProps<TriangleNodeData>) {
  const nodeDefinition = getNodeDefinition('triangle');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);
  const size = data.size ?? (nodeDefinition?.defaults.size as number) ?? 80;

  return (
    <NodeCard selected={selected}>
      <NodeHeader
        icon={<TriangleIcon size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">Side {size}px</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Orientation</span>
          <span className="font-medium text-[var(--text-primary)]">Centered upright</span>
        </div>
        <div className="text-xs text-[var(--text-muted)]">Triangular geometry</div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Shape output"
          description="Passes the triangle to the next node."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
