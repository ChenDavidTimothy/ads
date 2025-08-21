// src/components/workspace/nodes/rectangle-node.tsx - Simplified single output port
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { RectangleNodeData } from "@/shared/types/nodes";
import { Square as SquareIcon } from "lucide-react";

export function RectangleNode({
  data,
  selected,
}: NodeProps<RectangleNodeData>) {
  const nodeDefinition = getNodeDefinition("rectangle");

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] p-[var(--card-padding)]"
    >
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-primary)]"
            style={{ backgroundColor: "#4444ff" }} // Canvas default
          >
            <SquareIcon size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-1 p-0 text-xs text-[var(--text-secondary)]">
        <div>Width: {data.width || 100}px</div>
        <div>Height: {data.height || 60}px</div>
      </CardContent>

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--node-geometry)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}
