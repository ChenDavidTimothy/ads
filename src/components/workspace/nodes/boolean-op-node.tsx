'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Binary } from 'lucide-react';
import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { BooleanOpNodeData } from '@/shared/types/nodes';

function getOperatorLabel(operator: BooleanOpNodeData['operator']) {
  switch (operator) {
    case 'and':
      return 'AND';
    case 'or':
      return 'OR';
    case 'not':
      return 'NOT';
    case 'xor':
      return 'XOR';
    default:
      return 'Boolean';
  }
}

function getOperatorSymbol(operator: BooleanOpNodeData['operator']) {
  switch (operator) {
    case 'and':
      return '∧';
    case 'or':
      return '∨';
    case 'not':
      return '¬';
    case 'xor':
      return '⊕';
    default:
      return '?';
  }
}

export function BooleanOpNode({ data, selected }: NodeProps<BooleanOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts('boolean_op', data as unknown as Record<string, unknown>);

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input_1',
          label: 'Input 1',
          tooltip: 'Boolean input',
          handleClassName: 'bg-[var(--node-logic)]',
          badge: '1',
        },
        {
          id: 'input_2',
          label: 'Input 2',
          tooltip: 'Boolean input',
          handleClassName: 'bg-[var(--node-logic)]',
          badge: '2',
        },
      ];
    }

    return definitions.map((port, index) => ({
      id: port.id,
      label: `Input ${index + 1}`,
      tooltip: 'Boolean input',
      handleClassName: 'bg-[var(--node-logic)]',
      badge: String(index + 1),
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Boolean result',
          tooltip: 'Result of the boolean operation',
          handleClassName: 'bg-[var(--node-logic)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Boolean result',
      tooltip: 'Result of the boolean operation',
      handleClassName: 'bg-[var(--node-logic)]',
    }));
  }, [nodeDefinition]);

  const operatorLabel = getOperatorLabel(data.operator);
  const operatorSymbol = getOperatorSymbol(data.operator);

  const formula = data.operator === 'not' ? `${operatorSymbol}A` : `A ${operatorSymbol} B`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`Boolean ${operatorLabel}`}
      icon={<Binary size={14} />}
      iconClassName="bg-[var(--node-logic)]"
      inputs={inputs}
      outputs={outputs}
      measureDeps={[data.operator, inputs.length]}
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-[var(--space-2)] text-center font-mono text-sm text-[var(--text-primary)]">
        {formula}
      </div>
      <div className="text-xs text-[var(--text-secondary)]">Outputs true when the expression evaluates to true.</div>
    </NodeLayout>
  );
}
