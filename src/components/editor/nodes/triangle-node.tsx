"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { NODE_COLORS } from "@/lib/constants/editor";
import type { TriangleNodeData } from "@/lib/types/nodes";

export function TriangleNode({ data, selected }: NodeProps<TriangleNodeData>) {
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
          <span className="font-semibold text-white">Triangle</span>
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

      <Handle
        type="source"
        position={Position.Right}
        id="object"
        className={`w-3 h-3 ${NODE_COLORS.triangle.handle} !border-2 !border-white`}
      />
    </Card>
  );
}