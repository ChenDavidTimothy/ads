// src/components/workspace/nodes/constants-node.tsx - Constants value output node
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { ConstantsNodeData } from "@/shared/types/nodes";

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
      case 'number': return '🔢';
      case 'string': return '📝';
      case 'boolean': return '✓';
      case 'color': return '🎨';
      default: return '🔢';
    }
  };

  const handleClass = "bg-[var(--node-data)]";

  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--node-data)] flex items-center justify-center rounded text-[var(--text-primary)] font-bold text-sm">
            {getTypeIcon()}
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Type:</span>
          <span className="text-xs text-[var(--text-primary)] font-medium capitalize">
            {data.valueType}
          </span>
        </div>
        
        <div className="bg-[var(--surface-2)] p-2 rounded border border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)] mb-1">Current Value:</div>
          <div className="text-sm text-[var(--text-primary)] font-mono">
            {getValueDisplay()}
          </div>
        </div>

        {data.valueType === 'color' && (
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border border-[var(--border-primary)]"
              style={{ backgroundColor: data.colorValue }}
            />
            <span className="text-xs text-[var(--text-secondary)]">Preview</span>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)] text-center">
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
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}