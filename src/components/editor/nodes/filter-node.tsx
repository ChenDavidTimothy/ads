// src/components/editor/nodes/filter-node.tsx - Confirmed single input/output ports
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { NODE_COLORS } from "@/lib/constants/editor";
import { getNodeDefinition } from "@/shared/types/definitions";
import type { FilterNodeData } from "@/shared/types/nodes";

export function FilterNode({ data, selected }: NodeProps<FilterNodeData>) {
  const nodeDefinition = getNodeDefinition('filter');
  
  const selectedCount = data.selectedObjectIds?.length || 0;
  const hasSelection = selectedCount > 0;

  return (
    <Card selected={selected} className="p-4 min-w-[200px]">
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${NODE_COLORS.filter.handle} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-violet-600 flex items-center justify-center rounded text-white font-bold text-sm">
            ⏷
          </div>
          <span className="font-semibold text-white">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300">Selected:</span>
          <span className="text-xs text-white font-medium">{selectedCount}</span>
        </div>
        
        {hasSelection ? (
          <div className="text-xs text-green-400">
            {selectedCount} object{selectedCount !== 1 ? 's' : ''} passing through
          </div>
        ) : (
          <div className="text-xs text-yellow-400">
            No objects selected
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            Configure in Properties panel
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
          className={`w-3 h-3 ${NODE_COLORS.filter.handle} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}