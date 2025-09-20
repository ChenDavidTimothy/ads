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
  const nodeDefinition = getNodeDefinitionWithDynamicPorts(
    'boolean_op',
    data as unknown as Record<string, unknown>
  );

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    // Dynamic ports - should always have definitions from generateBooleanPorts
    return definitions.map((port, index) => ({
      id: port.id,
      label: port.label || `Input ${index + 1}`,
      tooltip: 'Boolean input',
      handleClassName: 'bg-[var(--node-logic)]',
      badge: String(index + 1),
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    // Dynamic ports - should always have definitions from generateBooleanPorts
    return definitions.map((port) => ({
      id: port.id,
      label: port.label || 'Boolean result',
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
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-[var(--space-2)] text-center font-mono text-sm text-[var(--text-primary)]">
        {formula}
      </div>
      <div className="text-xs text-[var(--text-secondary)]">
        Outputs true when the expression evaluates to true.
      </div>
    </NodeLayout>
  );
}
