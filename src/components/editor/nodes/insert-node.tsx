// src/components/editor/nodes/insert-node.tsx - Updated with user-defined names
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { NODE_COLORS } from "@/lib/constants/editor";
import { getNodeDefinition } from "@/lib/types/node-definitions";
import type { InsertNodeData } from "@/lib/types/nodes";

export function InsertNode({ data, selected }: NodeProps<InsertNodeData>) {
  const nodeDefinition = getNodeDefinition('insert');
  const displayName = data.userDefinedName || "Insert";
  
  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${NODE_COLORS.insert.handle} !border-2 !border-white`}
          style={{ top: `${50 + (index * 20)}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-600 flex items-center justify-center rounded text-white font-bold text-sm">
            ⏰
          </div>
          <span className="font-semibold text-white">{displayName}</span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-1 text-xs text-gray-300">
        <div>Appears at: {data.appearanceTime}s</div>
        {data.appearanceTime === 0 ? (
          <div className="text-green-400">Instant presence</div>
        ) : (
          <div className="text-blue-400">Delayed presence</div>
        )}
      </CardContent>

      {nodeDefinition?.ports.outputs.map((port, index) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${NODE_COLORS.insert.handle} !border-2 !border-white`}
          style={{ top: `${50 + (index * 20)}%` }}
          title={`Output: Timed ${displayName}`}
        />
      ))}
    </Card>
  );
}