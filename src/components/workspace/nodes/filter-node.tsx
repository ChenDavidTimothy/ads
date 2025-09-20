'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { FilterNodeData } from '@/shared/types/nodes';
import { Filter as FilterIcon } from 'lucide-react';

export function FilterNode({ data, selected }: NodeProps<FilterNodeData>) {
  const nodeDefinition = getNodeDefinition('filter');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Objects to filter',
      description: 'Provide objects and use the property panel to choose which pass through.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Filtered objects',
      description: 'Emits only the objects that match your selection.',
    },
  });

  const selectedCount = data.selectedObjectIds?.length ?? 0;
  const hasSelection = selectedCount > 0;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={hasSelection ? `${selectedCount} object${selectedCount === 1 ? '' : 's'} selected` : 'No objects selected'}
      icon={<FilterIcon className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-logic)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-logic)]"
    >
      <div
        className={`text-xs ${hasSelection ? 'text-[var(--success-500)]' : 'text-[var(--warning-600)]'}`}
      >
        {hasSelection
          ? `${selectedCount} object${selectedCount === 1 ? '' : 's'} passing through`
          : 'Select objects in the property panel'}
      </div>
    </NodeLayout>
  );
}
