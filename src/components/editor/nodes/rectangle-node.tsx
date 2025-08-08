// src/components/editor/nodes/rectangle-node.tsx - Simplified single output port
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { RectangleNodeData } from "@/shared/types/nodes";

export function RectangleNode({ data, selected }: NodeProps<RectangleNodeData>) {
  const nodeDefinition = getNodeDefinition('rectangle');
  
  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-4 flex items-center justify-center rounded text-white font-bold text-xs"
            style={{ backgroundColor: data.color }}
          >
            ▬
          </div>
          <span className="font-semibold text-white">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-1 text-xs text-gray-300">
        <div>Size: {data.width}×{data.height}px</div>
        <div>Position: ({data.position.x}, {data.position.y})</div>
        <div className="flex items-center gap-2">
          <span>Color:</span>
          <div 
            className="w-4 h-4 rounded border border-gray-500"
            style={{ backgroundColor: data.color }}
          />
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