// src/components/workspace/nodes/math-op-node.tsx - Math operation node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Calculator } from 'lucide-react';

import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';
import type { MathOpNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function MathOpNode({ data, selected }: NodeProps<MathOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts(
    'math_op',
    data as unknown as Record<string, unknown>
  );
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const getOperatorDisplay = () => {
    switch (data.operator) {
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
    }
  };

  const getOperatorSymbol = () => {
    switch (data.operator) {
      case 'add':
        return '+';
      case 'subtract':
        return '−';
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
    }
  };

  const isUnaryOperation = data.operator === 'sqrt' || data.operator === 'abs';

  return (
    <NodeCard selected={selected}>
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top={`${35 + index * 30}%`}
          label={index === 0 ? 'First value' : 'Second value'}
          description={
            index === 0
              ? 'Primary value for the calculation.'
              : 'Optional second value when the rule needs it.'
          }
          handleClassName={visuals.handle}
          accent={category}
          icon={
            <span className="text-[0.65rem] leading-none font-semibold">
              {index === 0 ? 'A' : 'B'}
            </span>
          }
        />
      ))}

      <NodeHeader
        icon={<Calculator size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{getOperatorDisplay()}</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] text-center text-[var(--text-primary)]">
          {isUnaryOperation ? `${getOperatorSymbol()} A` : `A ${getOperatorSymbol()} B`}
        </div>
        <div className="text-xs text-[var(--text-muted)]">Mathematical operations</div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Calculated result"
          description="Emits the outcome of this operation."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
