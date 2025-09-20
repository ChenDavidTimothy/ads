'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { ConstantsNodeData } from '@/shared/types/nodes';

export function ConstantsNode({ data, selected }: NodeProps<ConstantsNodeData>) {
  const nodeDefinition = getNodeDefinition('constants');

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Constant value',
      description: 'Provides a reusable constant downstream.',
    },
  });

  const getCurrentValue = () => {
    switch (data.valueType) {
      case 'number':
        return data.numberValue;
      case 'string':
        return `"${data.stringValue}"`;
      case 'boolean':
        return data.booleanValue === 'true' ? 'true' : 'false';
      case 'color':
        return data.colorValue.toUpperCase();
      default:
        return 'Unknown';
    }
  };

  const value = getCurrentValue();
  const valueDisplay = String(value).length > 16 ? `${String(value).slice(0, 13)}…` : String(value);

  const getTypeIcon = () => {
    switch (data.valueType) {
      case 'number':
        return '🔢';
      case 'string':
        return '📝';
      case 'boolean':
        return '✓';
      case 'color':
        return '🎨';
      default:
        return '🔢';
    }
  };

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`Type: ${data.valueType}`}
      icon={<span className="text-xs">{getTypeIcon()}</span>}
      iconBackgroundClass="bg-[var(--node-data)] text-[var(--text-primary)]"
      inputs={[]}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-data)]"
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-[var(--space-2)]">
        <div className="mb-[var(--space-1)] text-xs text-[var(--text-tertiary)]">Current value</div>
        <div className="font-mono text-sm text-[var(--text-primary)]">{valueDisplay}</div>
      </div>
      {data.valueType === 'color' ? (
        <div className="flex items-center gap-[var(--space-2)] text-xs">
          <div
            className="h-4 w-4 rounded border border-[var(--border-primary)]"
            style={{ backgroundColor: data.colorValue }}
          />
          <span className="text-[var(--text-secondary)]">Preview</span>
        </div>
      ) : null}
    </NodeLayout>
  );
}
