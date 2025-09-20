// src/components/workspace/nodes/circle-node.tsx - Circular geometry node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Circle as CircleIcon } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { CircleNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function CircleNode({ data, selected }: NodeProps<CircleNodeData>) {
  const nodeDefinition = getNodeDefinition('circle');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);
  const radius = data.radius ?? (nodeDefinition?.defaults.radius as number) ?? 50;

  return (
    <NodeCard selected={selected}>
      <NodeHeader
        icon={<CircleIcon size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">Radius {radius}px</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Edge softness</span>
          <span className="font-medium text-[var(--text-primary)]">Perfectly round</span>
        </div>
        <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[11px]">
          Emits a smooth circle that pairs well with gradient fills, masks, or duplication nodes.
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
          description="Passes the circle forward for styling or animation."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
