"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { ImageNodeData } from "@/shared/types/nodes";
import { Image } from "lucide-react";

export function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const nodeDefinition = getNodeDefinition('image');

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-input)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <Image size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-1 text-xs text-[var(--text-secondary)]">
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
          className="w-3 h-3 bg-[var(--node-input)] !border-2 !border-[var(--text-primary)]"
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}
