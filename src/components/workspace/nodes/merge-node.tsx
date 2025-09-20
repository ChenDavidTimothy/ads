// src/components/workspace/nodes/merge-node.tsx - Merge node UI
'use client';

import type { NodeProps } from 'reactflow';
import { GitMerge } from 'lucide-react';

import type { MergeNodeData } from '@/shared/types/nodes';
import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function MergeNode({ data, selected }: NodeProps<MergeNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts(
    'merge',
    data as unknown as Record<string, unknown>
  );
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);
  const portCount = data.inputPortCount || nodeDefinition?.ports.inputs.length || 2;

  const getPortTopPosition = (index: number) => {
    if (portCount <= 2) {
      return index === 0 ? '30%' : '70%';
    }
    if (portCount === 3) {
      return ['25%', '50%', '75%'][index];
    }
    if (portCount === 4) {
      return ['20%', '40%', '60%', '80%'][index];
    }
    return ['15%', '30%', '50%', '70%', '85%'][index];
  };

  const getNodeHeight = () => {
    if (portCount <= 2) return 'min-h-[130px]';
    if (portCount === 3) return 'min-h-[150px]';
    if (portCount === 4) return 'min-h-[170px]';
    return 'min-h-[190px]';
  };

  return (
    <NodeCard selected={selected} className={getNodeHeight()}>
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top={getPortTopPosition(index) ?? '50%'}
          label={index === 0 ? 'Primary stream' : `Stream ${index + 1}`}
          description={
            index === 0 ? 'Takes priority when IDs collide.' : 'Blends in when space is available.'
          }
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<GitMerge size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{portCount} inputs</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)]">
          Incoming streams are merged in order—use the first input when you need deterministic
          overrides.
        </div>
        <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[11px]">
          Helpful for bringing parallel branches back together after conditional logic.
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Merged stream"
          description="Outputs a single flow containing all upstream entries."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
