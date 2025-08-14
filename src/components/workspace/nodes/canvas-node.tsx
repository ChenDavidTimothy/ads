// src/components/workspace/nodes/canvas-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { CanvasNodeData } from "@/shared/types/nodes";

type CanvasNodeProps = NodeProps<CanvasNodeData> & { onOpenCanvas?: () => void };

export function CanvasNode({ data, selected, onOpenCanvas }: CanvasNodeProps) {
  const nodeDefinition = getNodeDefinition('canvas');

  const handleDoubleClick = () => {
    if (onOpenCanvas) return onOpenCanvas();
    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'canvas');
    url.searchParams.set('node', data.identifier.id);
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  const handleClass = "bg-[var(--node-geometry)]";

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)] cursor-pointer transition-all hover:bg-[var(--surface-interactive)]" onDoubleClick={handleDoubleClick}>
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
      {nodeDefinition?.ports.outputs.map((port, idx) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `${50 + idx * 16}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-geometry)] flex items-center justify-center rounded text-[var(--text-primary)] font-bold text-sm">
            🖼️
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {data.identifier.displayName}
            </div>
            <div className="text-xs text-[var(--text-tertiary)] font-mono">
              {data.identifier.id.split('_').pop()}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Position:</span>
          <span className="text-[var(--text-primary)] font-medium">({data.position.x}, {data.position.y})</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Rotation:</span>
          <span className="text-[var(--text-primary)] font-medium">{data.rotation} rad</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Scale:</span>
          <span className="text-[var(--text-primary)] font-medium">{data.scale.x}×{data.scale.y}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Opacity:</span>
          <span className="text-[var(--text-primary)] font-medium">{Math.round(data.opacity * 100)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Fill/Stroke:</span>
          <div className="flex items-center gap-[var(--space-2)]">
            <div className="w-4 h-4 rounded border border-[var(--border-primary)]" style={{ backgroundColor: data.fillColor }} />
            <div className="w-4 h-4 rounded border border-[var(--border-primary)]" style={{ backgroundColor: data.strokeColor }} />
            <span className="text-[var(--text-primary)] font-medium text-xs">{data.strokeWidth}px</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}