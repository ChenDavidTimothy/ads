// src/components/workspace/nodes/boolean-op-node.tsx - Boolean operation logic node
'use client';

import type { NodeProps } from 'reactflow';
import { Binary } from 'lucide-react';

import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';
import type { BooleanOpNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function BooleanOpNode({ data, selected }: NodeProps<BooleanOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts(
    'boolean_op',
    data as unknown as Record<string, unknown>
  );
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const getOperatorDisplay = () => {
    switch (data.operator) {
      case 'and':
        return 'AND';
      case 'or':
        return 'OR';
      case 'not':
        return 'NOT';
      case 'xor':
        return 'XOR';
    }
  };

  const getOperatorSymbol = () => {
    switch (data.operator) {
      case 'and':
        return '∧';
      case 'or':
        return '∨';
      case 'not':
        return '¬';
      case 'xor':
        return '⊕';
    }
  };

  const isUnary = data.operator === 'not';

  const inputCopy = isUnary
    ? [
        {
          label: 'Signal to flip',
          description: 'Connect the input you want to invert.',
          icon: <span className="text-[0.65rem] leading-none font-semibold">A</span>,
        },
      ]
    : [
        {
          label: 'First value',
          description: 'Primary signal for the rule.',
          icon: <span className="text-[0.65rem] leading-none font-semibold">A</span>,
        },
        {
          label: 'Second value',
          description: 'Secondary signal to evaluate with the first.',
          icon: <span className="text-[0.65rem] leading-none font-semibold">B</span>,
        },
      ];

  return (
    <NodeCard selected={selected}>
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top={`${35 + index * 30}%`}
          label={inputCopy[index]?.label ?? 'Input'}
          description={inputCopy[index]?.description}
          handleClassName={visuals.handle}
          accent={category}
          icon={inputCopy[index]?.icon}
        />
      ))}

      <NodeHeader
        icon={<Binary size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {getOperatorDisplay()}
          </span>
        }
      />

      <div className="space-y-[var(--space-3)]">
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] text-center">
          <div className="text-[11px] tracking-[0.18em] text-[var(--text-tertiary)] uppercase">
            Logic rule
          </div>
          <div className="mt-[var(--space-2)] text-lg font-semibold text-[var(--text-primary)]">
            {isUnary ? `${getOperatorSymbol()}A` : `A ${getOperatorSymbol()} B`}
          </div>
        </div>

        <div className="text-xs text-[var(--text-muted)]">Boolean logic operations</div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Logic result"
          description="Emits when the rule passes."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
