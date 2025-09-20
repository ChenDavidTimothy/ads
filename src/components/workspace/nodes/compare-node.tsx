// src/components/workspace/nodes/compare-node.tsx - Compare logic node

'use client';

import type { NodeProps } from 'reactflow';
import { Equal } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { CompareNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function CompareNode({ data, selected }: NodeProps<CompareNodeData>) {
  const nodeDefinition = getNodeDefinition('compare');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

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
    }
  };

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
              ? 'Connect the value you want to test.'
              : 'Connect what you want to compare against.'
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
        icon={<Equal size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {getOperatorLabel()}
          </span>
        }
      />

      <div className="space-y-[var(--space-3)]">
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] text-center">
          <div className="text-[11px] tracking-[0.18em] text-[var(--text-tertiary)] uppercase">
            Comparison
          </div>
          <div className="mt-[var(--space-2)] text-lg font-semibold text-[var(--text-primary)]">
            A {getOperatorSymbol()} B
          </div>
        </div>

        <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[11px] text-[var(--text-secondary)]">
          Align both inputs to the same kind of content so the comparison behaves as expected.
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Pass / fail signal"
          description="Sends “yes” when the condition is satisfied."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
