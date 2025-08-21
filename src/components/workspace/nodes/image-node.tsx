"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { ImageNodeData } from "@/shared/types/nodes";
import { Image } from "lucide-react";

export function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const nodeDefinition = getNodeDefinition("image");

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] p-[var(--card-padding)]"
    >
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-input)] text-[var(--text-primary)]">
            <Image size={12} aria-label="Image node icon" />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-1 p-0 text-xs text-[var(--text-secondary)]">
        <div className="text-[var(--text-tertiary)]">
          Connect to Media node for editing
        </div>
      </CardContent>

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className="h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--node-input)]"
          style={{ top: "50%" }}
        />
      ))}
    </Card>
  );
}
