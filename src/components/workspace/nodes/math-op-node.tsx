'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Calculator } from 'lucide-react';
import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { MathOpNodeData } from '@/shared/types/nodes';

function getOperatorLabel(operator: MathOpNodeData['operator']) {
  switch (operator) {
    case 'add':
      return 'Add';
    case 'subtract':
      return 'Subtract';
    case 'multiply':
      return 'Multiply';
    case 'divide':
      return 'Divide';
    case 'modulo':
      return 'Modulo';
    case 'power':
      return 'Power';
    case 'sqrt':
      return 'Square root';
    case 'abs':
      return 'Absolute';
    case 'min':
      return 'Minimum';
    case 'max':
      return 'Maximum';
    default:
      return 'Math';
  }
}

function getOperatorSymbol(operator: MathOpNodeData['operator']) {
  switch (operator) {
    case 'add':
      return '+';
    case 'subtract':
      return '-';
    case 'multiply':
      return '×';
    case 'divide':
      return '÷';
    case 'modulo':
      return '%';
    case 'power':
      return '^';
    case 'sqrt':
      return '√';
    case 'abs':
      return '| |';
    case 'min':
      return 'min';
    case 'max':
      return 'max';
    default:
      return '?';
  }
}

export function MathOpNode({ data, selected }: NodeProps<MathOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts('math_op', data as unknown as Record<string, unknown>);

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input_1',
          label: 'Input 1',
          tooltip: 'Numeric input',
          handleClassName: 'bg-[var(--node-logic)]',
          badge: '1',
        },
        {
          id: 'input_2',
          label: 'Input 2',
          tooltip: 'Numeric input',
          handleClassName: 'bg-[var(--node-logic)]',
          badge: '2',
        },
      ];
    }

    return definitions.map((port, index) => ({
      id: port.id,
      label: `Input ${index + 1}`,
      tooltip: 'Numeric input',
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
          label: 'Calculated value',
          tooltip: 'Result of the math operation',
          handleClassName: 'bg-[var(--node-logic)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Calculated value',
      tooltip: 'Result of the math operation',
      handleClassName: 'bg-[var(--node-logic)]',
    }));
  }, [nodeDefinition]);

  const isUnary = data.operator === 'sqrt' || data.operator === 'abs';
  const symbol = getOperatorSymbol(data.operator);

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={getOperatorLabel(data.operator)}
      icon={<Calculator size={14} />}
      iconClassName="bg-[var(--node-logic)]"
      inputs={inputs}
      outputs={outputs}
      measureDeps={[data.operator, inputs.length]}
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-[var(--space-2)] text-center font-mono text-sm text-[var(--text-primary)]">
        {isUnary ? `${symbol}A` : `A ${symbol} B`}
      </div>
      <div className="text-xs text-[var(--text-secondary)]">Returns the numeric result of the expression.</div>
    </NodeLayout>
  );
}
