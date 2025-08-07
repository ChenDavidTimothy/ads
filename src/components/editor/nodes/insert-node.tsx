// src/components/editor/nodes/insert-node.tsx - Simplified single input/output ports
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { NODE_COLORS } from "@/lib/constants/editor";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { InsertNodeData } from "@/shared/types/nodes";

export function InsertNode({ data, selected }: NodeProps<InsertNodeData>) {
  const nodeDefinition = getNodeDefinition('insert');
  
  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-600 flex items-center justify-center rounded text-white font-bold text-sm">
            ⏰
          </div>
          <span className="font-semibold text-white">
            {data.identifier.displayName}
          </span>
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

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}