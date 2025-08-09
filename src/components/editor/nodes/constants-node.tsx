// src/components/editor/nodes/constants-node.tsx - Constants value output node
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

  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-cyan-600 flex items-center justify-center rounded text-white font-bold text-sm">
            {getTypeIcon()}
          </div>
          <span className="font-semibold text-white">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300">Type:</span>
          <span className="text-xs text-white font-medium capitalize">
            {data.valueType}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded border">
          <div className="text-xs text-gray-400 mb-1">Current Value:</div>
          <div className="text-sm text-white font-mono">
            {getValueDisplay()}
          </div>
        </div>

        {data.valueType === 'color' && (
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border border-gray-500"
              style={{ backgroundColor: data.colorValue }}
            />
            <span className="text-xs text-gray-300">Preview</span>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
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
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-gray-500'} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}