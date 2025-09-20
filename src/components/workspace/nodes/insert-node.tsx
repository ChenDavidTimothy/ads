// src/components/workspace/nodes/insert-node.tsx - Timing insert node UI
'use client';

import React from 'react';
import type { NodeProps } from 'reactflow';
import { Clock3 } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { InsertNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';
import { InsertModal } from './InsertModal';

export function InsertNode({ data, selected }: NodeProps<InsertNodeData>) {
  const nodeDefinition = getNodeDefinition('insert');
  const [open, setOpen] = React.useState(false);
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);
  const appearanceTime = data.appearanceTime ?? 0;

  return (
    <NodeCard selected={selected} className="cursor-pointer" onDoubleClick={() => setOpen(true)}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Objects to schedule"
          description="Connect the stream you want to delay."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<Clock3 size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{appearanceTime}s</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Start time</span>
          <span className="font-medium text-[var(--text-primary)]">{appearanceTime}s</span>
        </div>
        <div className="text-xs text-[var(--text-muted)]">Timing control</div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Scheduled objects"
          description="Emits the stream once the start time is reached."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      {open ? (
        <InsertModal isOpen={open} onClose={() => setOpen(false)} nodeId={data.identifier.id} />
      ) : null}
    </NodeCard>
  );
}
