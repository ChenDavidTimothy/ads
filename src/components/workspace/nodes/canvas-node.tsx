// src/components/workspace/nodes/canvas-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { CanvasNodeData } from "@/shared/types/nodes";
import { Palette } from "lucide-react";

type CanvasNodeProps = NodeProps<CanvasNodeData> & {
  onOpenCanvas?: () => void;
};

export function CanvasNode({ data, selected, onOpenCanvas }: CanvasNodeProps) {
  const nodeDefinition = getNodeDefinition("canvas");

  const handleDoubleClick = () => {
    if (onOpenCanvas) return onOpenCanvas();
    const params = new URLSearchParams(window.location.search);
    const ws = params.get("workspace");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "canvas");
    url.searchParams.set("node", data?.identifier?.id ?? "");
    if (ws) url.searchParams.set("workspace", ws);
    window.history.pushState({}, "", url.toString());
  };

  const handleClass = "bg-[var(--node-geometry)]";

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] cursor-pointer p-[var(--card-padding)] transition-all hover:bg-[var(--surface-interactive)]"
      onDoubleClick={handleDoubleClick}
    >
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
      {nodeDefinition?.ports.outputs.map((port, idx) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `${50 + idx * 16}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-geometry)] text-[var(--text-primary)]">
            <Palette size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-[var(--text-primary)]">
              {data?.identifier?.displayName ?? "Canvas"}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-0 text-xs text-[var(--text-secondary)]">
        <div className="pt-1 text-[10px] text-[var(--text-tertiary)]">
          Double-click to edit in Canvas tab
        </div>
      </CardContent>
    </Card>
  );
}
