// src/components/workspace/nodes/boolean-op-node.tsx - Boolean operation node with structured layout
'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout, type NodePortDisplay } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';
import type { BooleanOpNodeData } from '@/shared/types/nodes';
import { Binary } from 'lucide-react';

export function BooleanOpNode({ data, selected }: NodeProps<BooleanOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts(
    'boolean_op',
    data as unknown as Record<string, unknown>
  );

  const OPERATOR_DISPLAY: Record<BooleanOpNodeData['operator'], string> = {
    and: 'AND',
    or: 'OR',
    not: 'NOT',
    xor: 'XOR',
  };

  const OPERATOR_SYMBOL: Record<BooleanOpNodeData['operator'], string> = {
    and: '∧',
    or: '∨',
    not: '¬',
    xor: '⊕',
  };

  const getOperatorDisplay = () => OPERATOR_DISPLAY[data.operator];
  const getOperatorSymbol = () => OPERATOR_SYMBOL[data.operator];

  const inputPorts: NodePortDisplay[] = (nodeDefinition?.ports.inputs ?? []).map((port, index) => ({
    id: port.id,
    label:
      data.operator === 'not'
        ? 'Boolean input'
        : index === 0
          ? 'Condition A'
          : 'Condition B',
    description: 'Provide boolean values to evaluate.',
  }));

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Boolean result',
      description: 'Outputs the evaluated boolean value.',
    },
  });

  const subtitle = `Operation: ${getOperatorDisplay()}`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<Binary className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-logic)] text-[var(--text-primary)]"
      inputs={inputPorts}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-logic)]"
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-2 text-center">
        <div className="font-mono text-sm text-[var(--text-primary)]">Bool ({getOperatorDisplay()})</div>
        <div className="mt-1 font-mono text-lg text-[var(--text-primary)]">
          {data.operator === 'not' ? `${getOperatorSymbol()}A` : `A ${getOperatorSymbol()} B`}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Inputs</span>
        <span className="font-medium text-[var(--text-primary)]">
          {data.operator === 'not' ? '1 boolean' : '2 booleans'}
        </span>
      </div>
    </NodeLayout>
  );
}
