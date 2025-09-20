'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { DuplicateNodeData } from '@/shared/types/nodes';
import { Copy } from 'lucide-react';

export function DuplicateNode({ data, selected }: NodeProps<DuplicateNodeData>) {
  const nodeDefinition = getNodeDefinition('duplicate');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Objects to duplicate',
      description: 'Supply any object stream to create copies.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Duplicated objects',
      description: 'Emits the original and duplicates in order.',
    },
  });

  const subtitle = `Copies: ${data.count}`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<Copy className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-logic)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-logic)]"
    >
      <div className="text-xs text-[var(--text-secondary)]">
        {data.count === 1
          ? 'Pass-through mode'
          : `Creates ${data.count - 1} additional duplicate${data.count > 2 ? 's' : ''}.`}
      </div>
      <div className="text-xs text-[var(--text-tertiary)] italic">
        Works with any object type.
      </div>
    </NodeLayout>
  );
}
