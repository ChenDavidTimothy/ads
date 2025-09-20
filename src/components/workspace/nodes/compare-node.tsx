'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout, type NodePortDisplay } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { CompareNodeData } from '@/shared/types/nodes';
import { Equal } from 'lucide-react';

export function CompareNode({ data, selected }: NodeProps<CompareNodeData>) {
  const nodeDefinition = getNodeDefinition('compare');

  const getOperatorSymbol = () => {
    switch (data.operator) {
      case 'gt':
        return '>';
      case 'lt':
        return '<';
      case 'eq':
        return '==';
      case 'neq':
        return '!=';
      case 'gte':
        return '>=';
      case 'lte':
        return '<=';
      default:
        return '?';
    }
  };

  const getOperatorLabel = () => {
    switch (data.operator) {
      case 'gt':
        return 'Greater than';
      case 'lt':
        return 'Less than';
      case 'eq':
        return 'Equal';
      case 'neq':
        return 'Not equal';
      case 'gte':
        return 'Greater or equal';
      case 'lte':
        return 'Less or equal';
      default:
        return 'Comparison';
    }
  };

  const inputs: NodePortDisplay[] = (nodeDefinition?.ports.inputs ?? []).map((port, index) => ({
    id: port.id,
    label: index === 0 ? 'Value A' : 'Value B',
    description: 'Supply the values to compare.',
  }));

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Comparison result',
      description: 'Outputs true or false based on the comparison.',
    },
  });

  const subtitle = `Operation: ${getOperatorLabel()}`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<Equal className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-logic)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-logic)]"
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-2 text-center">
        <div className="font-mono text-lg text-[var(--text-primary)]">A {getOperatorSymbol()} B</div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Outputs</span>
        <span className="font-medium text-[var(--text-primary)]">Boolean</span>
      </div>
    </NodeLayout>
  );
}
