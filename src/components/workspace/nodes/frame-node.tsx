// src/components/workspace/nodes/frame-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { FrameNodeData } from "@/shared/types/nodes";
import { Image as ImageIcon } from "lucide-react";

export function FrameNode({ data, selected }: NodeProps<FrameNodeData>) {
  const nodeDefinition = getNodeDefinition('frame');

  const getResolutionLabel = (width: number, height: number) => {
    if (width === 1920 && height === 1080) return "FHD";
    if (width === 1280 && height === 720) return "HD";
    if (width === 3840 && height === 2160) return "4K";
    if (width === 1080 && height === 1080) return "Square";
    return "Custom";
  };

  const handleClass = "bg-[var(--node-output)]";

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-output)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <ImageIcon size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {data.identifier.displayName}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Resolution:</span>
          <span className="text-[var(--text-primary)] font-medium">
            {getResolutionLabel(data.width || 1920, data.height || 1080)} ({data.width || 1920}×{data.height || 1080})
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Background:</span>
          <div className="flex items-center gap-[var(--space-2)]">
            <div
              className="w-4 h-4 rounded border border-[var(--border-primary)]"
              style={{ backgroundColor: data.backgroundColor || '#000000' }}
            />
            <span className="text-[var(--text-primary)] font-medium text-xs">
              {data.backgroundColor?.toUpperCase() || '#000000'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span>Format:</span>
          <span className="text-[var(--text-primary)] font-medium uppercase">{data.format || 'png'}</span>
        </div>

        {(data.format || 'png') === 'jpeg' && (
          <div className="flex items-center justify-between">
            <span>Quality:</span>
            <span className="text-[var(--text-primary)] font-medium">{data.quality || 90}</span>
          </div>
        )}

        <div className="mt-[var(--space-4)] pt-[var(--space-3)] border-t border-[var(--border-primary)] text-center text-xs text-[var(--text-tertiary)]">
          Final Image Output
        </div>
      </CardContent>
    </Card>
  );
}