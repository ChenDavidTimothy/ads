// src/components/workspace/nodes/insert-node.tsx - Simplified single input/output ports
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { InsertNodeData } from "@/shared/types/nodes";

export function InsertNode({ data, selected }: NodeProps<InsertNodeData>) {
  const nodeDefinition = getNodeDefinition('insert');
  
  const handleClass = "bg-[var(--node-data)]";

  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
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

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--node-data)] flex items-center justify-center rounded text-[var(--text-primary)] font-bold text-sm">
            ⏰
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-1 text-xs text-[var(--text-secondary)]">
        <div>Appears at: {data.appearanceTime}s</div>
        {data.appearanceTime === 0 ? (
          <div className="text-[var(--success-500)]">Instant presence</div>
        ) : (
          <div className="text-[var(--accent-600)]">Delayed presence</div>
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