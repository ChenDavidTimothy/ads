// src/components/workspace/nodes/insert-node.tsx - Simplified single input/output ports
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { InsertNodeData } from "@/shared/types/nodes";

export function InsertNode({ data, selected }: NodeProps<InsertNodeData>) {
  const nodeDefinition = getNodeDefinition("insert");

  const handleClass = "bg-[var(--node-data)]";

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] p-[var(--card-padding)]"
    >
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-data)] text-sm font-bold text-[var(--text-primary)]">
            ⏰
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-1 p-0 text-xs text-[var(--text-secondary)]">
        <div>Appears at: {data.appearanceTime}s</div>
        {data.appearanceTime === 0 ? (
          <div className="text-[var(--success-500)]">Instant presence</div>
        ) : (
          <div className="text-[var(--accent-primary)]">Delayed presence</div>
        )}
      </CardContent>

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}
