// src/components/editor/nodes/rectangle-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { NODE_COLORS } from "@/lib/constants/editor";
import { getNodeDefinition } from "@/lib/types/node-definitions";
import type { RectangleNodeData } from "@/lib/types/nodes";

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
          <span className="font-semibold text-white">Rectangle</span>
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

      {/* Render output ports */}
      {nodeDefinition?.ports.outputs.map((port, index) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${NODE_COLORS.rectangle.handle} !border-2 !border-white`}
          style={{ top: `${50 + (index * 20)}%` }}
        />
      ))}
    </Card>
  );
}