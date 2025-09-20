'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout, type NodePortDisplay } from './node-layout';
import { buildPortDisplays } from './port-utils';
import type { MergeNodeData } from '@/shared/types/nodes';
import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';

export function MergeNode({ data, selected }: NodeProps<MergeNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts(
    'merge',
    data as unknown as Record<string, unknown>
  );

  const inputPorts: NodePortDisplay[] = (nodeDefinition?.ports.inputs ?? []).map((port, index) => ({
    id: port.id,
    label: index === 0 ? 'Source 1 (priority)' : `Source ${index + 1}`,
    description:
      index === 0
        ? 'Primary stream when conflicts occur.'
        : 'Merged stream following the primary source.',
  }));

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Merged objects',
      description: 'Combined stream preserving priority order.',
    },
  });

  const portCount = inputPorts.length;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`${portCount} source${portCount === 1 ? '' : 's'}`}
      icon={<span className="text-xs">⊕</span>}
      iconBackgroundClass="bg-[var(--node-logic)] text-[var(--text-primary)]"
      inputs={inputPorts}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-logic)]"
    >
      <div className="text-xs text-[var(--text-secondary)]">
        Source 1 wins when IDs conflict. Additional sources cascade after.
      </div>
    </NodeLayout>
  );
}
