"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { TypographyNodeData } from "@/shared/types/nodes";
import { Type, Settings } from "lucide-react";

interface TypographyNodeProps extends NodeProps<TypographyNodeData> {
  onOpenTypography?: () => void;
}

export function TypographyNode({
  data,
  selected,
  onOpenTypography,
}: TypographyNodeProps) {
  const nodeDefinition = getNodeDefinition("typography");

  const handleDoubleClick = () => {
    if (onOpenTypography) return onOpenTypography();

    // Fallback URL navigation (follows AnimationNode pattern)
    const params = new URLSearchParams(window.location.search);
    const ws = params.get("workspace");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "typography");
    url.searchParams.set("node", data?.identifier?.id ?? "");
    if (ws) url.searchParams.set("workspace", ws);
    window.history.pushState({}, "", url.toString());
  };

  const currentFont = `${data.fontFamily || "Arial"} ${data.fontWeight || "normal"}`;

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
          className="h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--node-animation)]"
          style={{ top: "50%" }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-animation)] text-[var(--text-primary)]">
            <Type size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-[var(--text-primary)]">
              {data?.identifier?.displayName ?? "Typography"}
            </div>
          </div>
          <Settings size={12} className="text-[var(--text-tertiary)]" />
        </div>
      </CardHeader>

      <CardContent className="space-y-1 p-0 text-xs text-[var(--text-secondary)]">
        <div className="truncate">Font: {currentFont}</div>
        <div>Align: {data.textAlign || "center"}</div>
        <div>Line Height: {data.lineHeight || 1.2}</div>
        <div className="pt-1 text-[10px] text-[var(--text-tertiary)]">
          Double-click to edit in Typography tab
        </div>
      </CardContent>

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className="h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--node-animation)]"
          style={{ top: "50%" }}
        />
      ))}
    </Card>
  );
}
