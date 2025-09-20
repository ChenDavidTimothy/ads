// src/components/workspace/nodes/math-op-node.tsx - Math operation node with structured layout
'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout, type NodePortDisplay } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';
import type { MathOpNodeData } from '@/shared/types/nodes';
import { Calculator } from 'lucide-react';

export function MathOpNode({ data, selected }: NodeProps<MathOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts(
    'math_op',
    data as unknown as Record<string, unknown>
  );

  const OPERATOR_DISPLAY: Record<MathOpNodeData['operator'], string> = {
    add: 'ADD',
    subtract: 'SUBTRACT',
    multiply: 'MULTIPLY',
    divide: 'DIVIDE',
    modulo: 'MODULO',
    power: 'POWER',
    sqrt: 'SQUARE ROOT',
    abs: 'ABSOLUTE',
    min: 'MIN',
    max: 'MAX',
  };

  const OPERATOR_SYMBOL: Record<MathOpNodeData['operator'], string> = {
    add: '+',
    subtract: '-',
    multiply: '×',
    divide: '÷',
    modulo: '%',
    power: '^',
    sqrt: '√',
    abs: '|A|',
    min: 'min',
    max: 'max',
  };

  const getOperatorDisplay = () => OPERATOR_DISPLAY[data.operator];

  const getOperatorExpression = () => {
    if (data.operator === 'abs') {
      return OPERATOR_SYMBOL[data.operator];
    }
    if (data.operator === 'sqrt') {
      return `${OPERATOR_SYMBOL[data.operator]}A`;
    }
    return `A ${OPERATOR_SYMBOL[data.operator]} B`;
  };

  const isUnaryOperation = data.operator === 'sqrt' || data.operator === 'abs';

  const inputs: NodePortDisplay[] = (nodeDefinition?.ports.inputs ?? []).map((port, index) => ({
    id: port.id,
    label: isUnaryOperation ? 'Value' : index === 0 ? 'Value A' : 'Value B',
    description: 'Provide the numeric values for this operation.',
  }));

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Computed value',
      description: 'Outputs the numeric result of the operation.',
    },
  });

  const subtitle = `Operation: ${getOperatorDisplay()}`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<Calculator className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-logic)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-logic)]"
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-2 text-center">
        <div className="font-mono text-sm text-[var(--text-primary)]">Math ({getOperatorDisplay()})</div>
        <div className="mt-1 font-mono text-lg text-[var(--text-primary)]">{getOperatorExpression()}</div>
      </div>
    </NodeLayout>
  );
}
