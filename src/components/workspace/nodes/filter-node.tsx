// src/components/workspace/nodes/filter-node.tsx - Filter node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Filter as FilterIcon } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { FilterNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function FilterNode({ data, selected }: NodeProps<FilterNodeData>) {
  const nodeDefinition = getNodeDefinition('filter');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const selectedCount = data.selectedObjectIds?.length ?? 0;
  const hasSelection = selectedCount > 0;

  return (
    <NodeCard selected={selected}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Objects to evaluate"
          description="Provide the stream you want to narrow down."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<FilterIcon size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{selectedCount} kept</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Currently passing</span>
          <span className="font-medium text-[var(--text-primary)]">{selectedCount}</span>
        </div>
        <div
          className="rounded border px-[var(--space-3)] py-[var(--space-2)] text-[11px]"
          style={{
            borderColor: hasSelection ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.45)',
            color: hasSelection ? 'var(--success-500)' : 'var(--warning-600)',
          }}
        >
          {hasSelection
            ? `${selectedCount} item${selectedCount === 1 ? '' : 's'} allowed to continue.`
            : 'No items match the current filter.'}
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Filtered stream"
          description="Emits only the entries that pass the filter."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
