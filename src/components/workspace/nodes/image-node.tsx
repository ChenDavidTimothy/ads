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

      <CardContent className="p-0 space-y-2 text-xs text-[var(--text-secondary)]">
        <div className="w-full h-16 bg-[var(--surface-2)] rounded flex items-center justify-center">
          <Image size={16} className="text-[var(--text-tertiary)]" />
        </div>
        
        <div className="space-y-1">
          <div className="text-[var(--text-tertiary)]">
            Image node - connect to Media node for editing
          </div>
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
