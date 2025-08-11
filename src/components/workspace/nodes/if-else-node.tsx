// src/components/workspace/nodes/if-else-node.tsx - If/Else logic node
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { IfElseNodeData } from "@/shared/types/nodes";

export function IfElseNode({ data, selected }: NodeProps<IfElseNodeData>) {
  const nodeDefinition = getNodeDefinition('if_else');

  return (
    <Card selected={selected} className="p-4 min-w-[220px]">
      {/* Input port */}
      <Handle
        type="target"
        position={Position.Left}
        id="condition"
        className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-indigo-500'} !border-2 !border-white`}
        style={{ top: '50%' }}
      />

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 flex items-center justify-center rounded text-white font-bold text-sm">
            🔀
          </div>
          <span className="font-semibold text-white">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="bg-gray-700 p-2 rounded border text-center">
          <div className="text-sm text-white">
            if true → true<br/>if false → false
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="text-green-400 text-center">True</div>
          <div className="text-red-400 text-center">False</div>
        </div>

        <div className="text-xs text-center">
          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
            Simple
          </span>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            Condition → Output
          </div>
        </div>
      </CardContent>

      {/* Output ports */}
      <Handle
        type="source"
        position={Position.Right}
        id="true_path"
        className="w-3 h-3 bg-green-500 !border-2 !border-white"
        style={{ top: '35%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false_path"
        className="w-3 h-3 bg-red-500 !border-2 !border-white"
        style={{ top: '65%' }}
      />
    </Card>
  );
}
