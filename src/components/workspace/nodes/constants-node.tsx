'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Palette } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { ConstantsNodeData } from '@/shared/types/nodes';

function formatValue(data: ConstantsNodeData) {
  switch (data.valueType) {
    case 'number':
      return String(data.numberValue);
    case 'string':
      return data.stringValue.length > 30 ? `${data.stringValue.slice(0, 27)}…` : data.stringValue;
    case 'boolean':
      return data.booleanValue === 'true' ? 'true' : 'false';
    case 'color':
      return data.colorValue.toUpperCase();
    default:
      return '—';
  }
}

export function ConstantsNode({ data, selected }: NodeProps<ConstantsNodeData>) {
  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Constant value',
        tooltip: 'Emits the configured constant for downstream nodes',
        handleClassName: 'bg-[var(--node-data)]',
      },
    ],
    []
  );

  const displayValue = formatValue(data);

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`Outputs a ${data.valueType}`}
      icon={<Palette size={14} />}
      iconClassName="bg-[var(--node-data)]"
      inputs={[]}
      outputs={outputs}
    >
      <div className="flex items-center justify-between">
        <span>Current value</span>
        <span className="font-mono text-sm text-[var(--text-primary)]">{displayValue}</span>
      </div>
      {data.valueType === 'color' ? (
        <div className="flex items-center gap-[var(--space-2)]">
          <span
            className="h-4 w-4 rounded border border-[var(--border-primary)]"
            style={{ backgroundColor: data.colorValue }}
          />
          <span className="text-xs text-[var(--text-secondary)]">Preview swatch</span>
        </div>
      ) : null}
    </NodeLayout>
  );
}
