// src/components/workspace/nodes/constants-node.tsx - Constants node UI
'use client';

import type { JSX } from 'react';
import type { NodeProps } from 'reactflow';
import { Palette, Hash, Quote, Check } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { ConstantsNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

const TYPE_ICONS: Record<string, JSX.Element> = {
  number: <Hash size={14} />,
  string: <Quote size={14} />,
  boolean: <Check size={14} />,
  color: <Palette size={14} />,
};

const TYPE_LABELS: Record<string, string> = {
  number: 'Number value',
  string: 'Text value',
  boolean: 'Yes / No toggle',
  color: 'Color swatch',
};

export function ConstantsNode({ data, selected }: NodeProps<ConstantsNodeData>) {
  const nodeDefinition = getNodeDefinition('constants');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const currentValue = (() => {
    switch (data.valueType) {
      case 'number':
        return data.numberValue ?? 0;
      case 'string':
        return data.stringValue ?? '';
      case 'boolean':
        return data.booleanValue === 'true' ? 'true' : 'false';
      case 'color':
        return (data.colorValue ?? '#ffffff').toUpperCase();
      default:
        return '—';
    }
  })();

  const displayValue = (() => {
    const asString = String(currentValue);
    if (asString.length > 18) {
      return `${asString.slice(0, 15)}…`;
    }
    return asString;
  })();

  const typeKey = data.valueType ?? 'number';
  const icon = TYPE_ICONS[typeKey] ?? <Hash size={14} />;
  const typeLabel = TYPE_LABELS[typeKey] ?? 'Value';

  return (
    <NodeCard selected={selected}>
      <NodeHeader
        icon={icon}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{typeLabel}</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Current value</span>
          <span className="font-medium text-[var(--text-primary)]">{displayValue}</span>
        </div>
        {data.valueType === 'color' ? (
          <div className="flex items-center gap-[var(--space-2)]">
            <span className="text-[11px] text-[var(--text-tertiary)]">Preview</span>
            <span
              className="h-4 w-10 rounded border border-[var(--border-primary)]"
              style={{ backgroundColor: String(currentValue) }}
            />
          </div>
        ) : null}
        <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[11px]">
          Emits a constant value that can drive any downstream property or control flow.
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Constant output"
          description="Provides the configured value to connected nodes."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
