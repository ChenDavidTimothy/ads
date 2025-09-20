// src/components/workspace/nodes/insert-node.tsx - Timing insert node with structured layout
'use client';

import { useState } from 'react';
import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { InsertModal } from './InsertModal';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { InsertNodeData } from '@/shared/types/nodes';

export function InsertNode({ data, selected }: NodeProps<InsertNodeData>) {
  const nodeDefinition = getNodeDefinition('insert');
  const [open, setOpen] = useState(false);

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Objects to schedule',
      description: 'Connect objects that should appear later in the timeline.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Timed object stream',
      description: 'Emits objects with their appearance time set.',
    },
  });

  const appearanceTime = data.appearanceTime ?? 0;

  return (
    <>
      <NodeLayout
        selected={selected}
        className="cursor-pointer"
        title={data.identifier.displayName}
        subtitle={`Appears at ${appearanceTime}s`}
        icon={<span className="text-xs">⏰</span>}
        iconBackgroundClass="bg-[var(--node-data)] text-[var(--text-primary)]"
        inputs={inputs}
        outputs={outputs}
        accentHandleClass="!bg-[var(--node-data)]"
        onDoubleClick={() => setOpen(true)}
        footer="Double-click to edit per-object appearance times"
      >
        <div className="flex items-center justify-between text-xs">
          <span>Global time</span>
          <span className="font-medium text-[var(--text-primary)]">{appearanceTime.toFixed(2)}s</span>
        </div>
      </NodeLayout>

      {open ? <InsertModal isOpen={open} onClose={() => setOpen(false)} nodeId={data.identifier.id} /> : null}
    </>
  );
}
