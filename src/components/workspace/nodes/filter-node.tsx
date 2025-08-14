// src/components/workspace/nodes/filter-node.tsx - Confirmed single input/output ports
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { FilterNodeData } from "@/shared/types/nodes";
import { Filter } from "lucide-react";

export function FilterNode({ data, selected }: NodeProps<FilterNodeData>) {
  const nodeDefinition = getNodeDefinition('filter');
  
  const selectedCount = data.selectedObjectIds?.length || 0;
  const hasSelection = selectedCount > 0;

  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-logic)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <Filter size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Selected:</span>
          <span className="text-xs text-[var(--text-primary)] font-medium">{selectedCount}</span>
        </div>
        
        {hasSelection ? (
          <div className="text-xs text-[var(--success-500)]">
            {selectedCount} object{selectedCount !== 1 ? 's' : ''} passing through
          </div>
        ) : (
          <div className="text-xs text-[var(--warning-600)]">
            No objects selected
          </div>
        )}
      </CardContent>

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}