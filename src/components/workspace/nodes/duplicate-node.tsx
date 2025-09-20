// src/components/workspace/nodes/duplicate-node.tsx - Duplicate node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Copy } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { DuplicateNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function DuplicateNode({ data, selected }: NodeProps<DuplicateNodeData>) {
  const nodeDefinition = getNodeDefinition('duplicate');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  return (
    <NodeCard selected={selected}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Source stream"
          description="Connect the objects you want to copy."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<Copy size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{data.count} copies</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="text-xs text-[var(--text-muted)]">
          {data.count === 1 ? 'Pass-through mode' : `${data.count} total copies`}
        </div>
        <div className="text-xs text-[var(--text-muted)]">Creates multiple copies</div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Duplicated stream"
          description="Outputs the original plus any duplicates."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
