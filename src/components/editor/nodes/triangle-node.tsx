// src/components/editor/nodes/triangle-node.tsx - Updated with user-defined names
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { NODE_COLORS } from "@/lib/constants/editor";
import { getNodeDefinition } from "@/lib/types/node-definitions";
import type { TriangleNodeData } from "@/lib/types/nodes";

export function TriangleNode({ data, selected }: NodeProps<TriangleNodeData>) {
  const nodeDefinition = getNodeDefinition('triangle');
  
  // Display both node name and object name
  const nodeName = data.userDefinedName || "Triangle";
  const objectName = data.objectName || "Triangle Object";
  
  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 flex items-center justify-center rounded text-white font-bold"
            style={{ backgroundColor: data.color }}
          >
            ▲
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-white text-sm">{nodeName}</span>
            <span className="text-xs text-gray-400">{objectName}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-1 text-xs text-gray-300">
        <div>Size: {data.size}px</div>
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
          className={`w-3 h-3 ${NODE_COLORS.triangle.handle} !border-2 !border-white`}
          style={{ top: `${50 + (index * 20)}%` }}
          title={`Output: ${objectName}`}
        />
      ))}
    </Card>
  );
}