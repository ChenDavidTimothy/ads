'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Equal } from 'lucide-react';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { CompareNodeData } from '@/shared/types/nodes';

function getOperatorSymbol(operator: CompareNodeData['operator']) {
  switch (operator) {
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
}

function getOperatorLabel(operator: CompareNodeData['operator']) {
  switch (operator) {
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
}

export function CompareNode({ data, selected }: NodeProps<CompareNodeData>) {
  const nodeDefinition = getNodeDefinition('compare');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input_a',
          label: 'First value',
          tooltip: 'Value compared on the left side (A)',
          handleClassName: 'bg-[var(--node-logic)]',
          badge: 'A',
        },
        {
          id: 'input_b',
          label: 'Second value',
          tooltip: 'Value compared on the right side (B)',
          handleClassName: 'bg-[var(--node-logic)]',
          badge: 'B',
        },
      ];
    }

    return definitions.map((port, index) => ({
      id: port.id,
      label: index === 0 ? 'First value' : 'Second value',
      tooltip: index === 0
        ? 'Value compared on the left side (A)'
        : 'Value compared on the right side (B)',
      handleClassName: 'bg-[var(--node-logic)]',
      badge: index === 0 ? 'A' : 'B',
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Comparison result',
          tooltip: 'Boolean result of the configured comparison',
          handleClassName: 'bg-[var(--node-logic)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Comparison result',
      tooltip: 'Boolean result of the configured comparison',
      handleClassName: 'bg-[var(--node-logic)]',
    }));
  }, [nodeDefinition]);

  const operatorLabel = getOperatorLabel(data.operator);
  const operatorSymbol = getOperatorSymbol(data.operator);

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`${operatorLabel}`}
      icon={<Equal size={14} />}
      iconClassName="bg-[var(--node-logic)]"
      inputs={inputs}
      outputs={outputs}
      measureDeps={[data.operator]}
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-[var(--space-2)] text-center font-mono text-sm text-[var(--text-primary)]">
        A {operatorSymbol} B
      </div>
      <div className="text-xs text-[var(--text-secondary)]">
        Emits <span className="font-medium text-[var(--text-primary)]">true</span> when the comparison holds.
      </div>
    </NodeLayout>
  );
}
