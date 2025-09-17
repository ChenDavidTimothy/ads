// src/components/workspace/nodes/constants-node.tsx - Constants value output node
'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { ConstantsNodeData } from '@/shared/types/nodes';

export function ConstantsNode({ data, selected }: NodeProps<ConstantsNodeData>) {
  const nodeDefinition = getNodeDefinition('constants');

  // Get current value based on type
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

  const getValueDisplay = () => {
    const value = getCurrentValue();
    const maxLength = 12;
    const valueStr = String(value);

    if (valueStr.length > maxLength) {
      return valueStr.substring(0, maxLength - 3) + '...';
    }
    return valueStr;
  };

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

  const handleClass = 'bg-[var(--node-data)]';

  return (
    <Card selected={selected} className="min-w-[var(--node-min-width)] p-[var(--card-padding)]">
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-data)] text-sm font-bold text-[var(--text-primary)]">
            {getTypeIcon()}
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-[var(--space-2)] p-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Type:</span>
          <span className="text-xs font-medium text-[var(--text-primary)] capitalize">
            {data.valueType}
          </span>
        </div>

        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-[var(--space-2)]">
          <div className="mb-[var(--space-1)] text-xs text-[var(--text-tertiary)]">
            Current Value:
          </div>
          <div className="font-mono text-sm text-[var(--text-primary)]">{getValueDisplay()}</div>
        </div>

        {data.valueType === 'color' && (
          <div className="flex items-center gap-[var(--space-2)]">
            <div
              className="h-4 w-4 rounded border border-[var(--border-primary)]"
              style={{ backgroundColor: data.colorValue }}
            />
            <span className="text-xs text-[var(--text-secondary)]">Preview</span>
          </div>
        )}

        <div className="mt-[var(--space-3)] border-t border-[var(--border-primary)] pt-[var(--space-2)]">
          <div className="text-center text-xs text-[var(--text-tertiary)]">
            Constant Value Output
          </div>
        </div>
      </CardContent>

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}
