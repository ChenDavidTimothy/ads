// src/components/workspace/nodes/rectangle-node.tsx - Rectangular geometry node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Square as SquareIcon } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { RectangleNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function RectangleNode({ data, selected }: NodeProps<RectangleNodeData>) {
  const nodeDefinition = getNodeDefinition('rectangle');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);
  const width = data.width ?? (nodeDefinition?.defaults.width as number) ?? 100;
  const height = data.height ?? (nodeDefinition?.defaults.height as number) ?? 60;
  const aspectRatio = height === 0 ? '—' : `${Math.round((width / height) * 100) / 100}:1`;

  return (
    <NodeCard selected={selected}>
      <NodeHeader
        icon={<SquareIcon size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={
          <span className="text-xs text-[var(--text-secondary)]">
            {width}px × {height}px
          </span>
        }
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Aspect</span>
          <span className="font-medium text-[var(--text-primary)]">{aspectRatio}</span>
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Clean rectangular geometry
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Shape output"
          description="Passes the rectangle onward for further styling."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
