"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { DuplicateNodeData } from "@/shared/types/nodes";
import { Copy } from "lucide-react";

export function DuplicateNode({
  data,
  selected,
}: NodeProps<DuplicateNodeData>) {
  const nodeDefinition = getNodeDefinition("duplicate");
  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] p-[var(--card-padding)]"
    >
      {/* Input port */}
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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-logic)] text-[var(--text-primary)]">
            <Copy size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Count:</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {data.count}
          </span>
        </div>

        <div className="text-xs text-[var(--success-500)]">
          {data.count === 1
            ? "Pass-through mode"
            : `Creating ${data.count - 1} duplicate${data.count > 2 ? "s" : ""}`}
        </div>

        <div className="text-xs text-[var(--text-tertiary)] italic">
          Generic duplication - works with any node type
        </div>
      </CardContent>

      {/* Output port */}
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
