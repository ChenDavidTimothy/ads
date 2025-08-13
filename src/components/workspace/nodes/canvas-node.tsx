// src/components/workspace/nodes/canvas-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { CanvasNodeData } from "@/shared/types/nodes";

export function CanvasNode({ data, selected }: NodeProps<CanvasNodeData>) {
  const nodeDefinition = getNodeDefinition('canvas');

  return (
    <Card selected={selected} className="p-4 min-w-[220px]">
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-gray-500'} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}
      {nodeDefinition?.ports.outputs.map((port, idx) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-gray-500'} !border-2 !border-white`}
          style={{ top: `${50 + idx * 16}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-fuchsia-600 flex items-center justify-center rounded text-white font-bold text-sm">
            🖼️
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">
              {data.identifier.displayName}
            </div>
            <div className="text-xs text-gray-400 font-mono">
              {data.identifier.id.split('_').pop()}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2 text-xs text-gray-300">
        <div className="flex items-center justify-between">
          <span>Position:</span>
          <span className="text-white font-medium">({data.position.x}, {data.position.y})</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Rotation:</span>
          <span className="text-white font-medium">{data.rotation} rad</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Scale:</span>
          <span className="text-white font-medium">{data.scale.x}×{data.scale.y}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Opacity:</span>
          <span className="text-white font-medium">{Math.round(data.opacity * 100)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Fill/Stroke:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-gray-500" style={{ backgroundColor: data.fillColor }} />
            <div className="w-4 h-4 rounded border border-gray-500" style={{ backgroundColor: data.strokeColor }} />
            <span className="text-white font-medium text-xs">{data.strokeWidth}px</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}