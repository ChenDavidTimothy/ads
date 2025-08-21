// src/components/workspace/nodes/frame-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { FrameNodeData } from "@/shared/types/nodes";
import { Image as ImageIcon } from "lucide-react";

export function FrameNode({ data, selected }: NodeProps<FrameNodeData>) {
  const nodeDefinition = getNodeDefinition("frame");

  const getResolutionLabel = (width: number, height: number) => {
    if (width === 1920 && height === 1080) return "FHD";
    if (width === 1280 && height === 720) return "HD";
    if (width === 3840 && height === 2160) return "4K";
    if (width === 1080 && height === 1080) return "Square";
    return "Custom";
  };

  const handleClass = "bg-[var(--node-output)]";

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] p-[var(--card-padding)]"
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

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-output)] text-[var(--text-primary)]">
            <ImageIcon size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-[var(--text-primary)]">
              {data.identifier.displayName}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-[var(--space-2)] p-0 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Resolution:</span>
          <span className="font-medium text-[var(--text-primary)]">
            {getResolutionLabel(data.width || 1920, data.height || 1080)} (
            {data.width || 1920}×{data.height || 1080})
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Background:</span>
          <div className="flex items-center gap-[var(--space-2)]">
            <div
              className="h-4 w-4 rounded border border-[var(--border-primary)]"
              style={{ backgroundColor: data.backgroundColor || "#000000" }}
            />
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {data.backgroundColor?.toUpperCase() || "#000000"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span>Format:</span>
          <span className="font-medium text-[var(--text-primary)] uppercase">
            {data.format || "png"}
          </span>
        </div>

        {(data.format || "png") === "jpeg" && (
          <div className="flex items-center justify-between">
            <span>Quality:</span>
            <span className="font-medium text-[var(--text-primary)]">
              {data.quality || 90}
            </span>
          </div>
        )}

        <div className="mt-[var(--space-4)] border-t border-[var(--border-primary)] pt-[var(--space-3)] text-center text-xs text-[var(--text-tertiary)]">
          Final Image Output
        </div>
      </CardContent>
    </Card>
  );
}
