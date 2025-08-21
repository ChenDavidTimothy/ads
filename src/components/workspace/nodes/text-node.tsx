"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { TextNodeData } from "@/shared/types/nodes";
import { Type } from "lucide-react";

export function TextNode({ data, selected }: NodeProps<TextNodeData>) {
  const nodeDefinition = getNodeDefinition("text");

  const displayContent =
    data.content?.length > 20
      ? data.content.substring(0, 20) + "..."
      : data.content || "Hello World";

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] p-[var(--card-padding)]"
    >
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-text)] text-[var(--text-primary)]">
            <Type size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-1 p-0 text-xs text-[var(--text-secondary)]">
        <div className="rounded bg-[var(--surface-2)] p-1 font-mono text-[10px]">
          &ldquo;{displayContent}&rdquo;
        </div>
        <div>Size: {data.fontSize || 24}px</div>
      </CardContent>

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className="h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--node-text)]"
          style={{ top: "50%" }}
        />
      ))}
    </Card>
  );
}
