// src/components/workspace/nodes/canvas-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { CanvasNodeData } from "@/shared/types/nodes";
import { Palette } from "lucide-react";

type CanvasNodeProps = NodeProps<CanvasNodeData> & { onOpenCanvas?: () => void };

export function CanvasNode({ data, selected, onOpenCanvas }: CanvasNodeProps) {
  const nodeDefinition = getNodeDefinition('canvas');

  const handleDoubleClick = () => {
    if (onOpenCanvas) return onOpenCanvas();
    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'canvas');
    url.searchParams.set('node', data?.identifier?.id ?? '');
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  const handleClass = "bg-[var(--node-geometry)]";

  // Defensive fallbacks to handle older/sparse saved data
  const position = data?.position ?? { x: 0, y: 0 };
  const rotation = typeof (data as any)?.rotation === 'number' ? (data as any).rotation : 0;
  const scale = (data as any)?.scale && typeof (data as any).scale === 'object'
    ? { x: (data as any).scale.x ?? 1, y: (data as any).scale.y ?? 1 }
    : { x: 1, y: 1 };
  const opacity = typeof (data as any)?.opacity === 'number' ? (data as any).opacity : 1;
  const fillColor = (data as any)?.fillColor ?? '#ffffff';
  const strokeColor = (data as any)?.strokeColor ?? '#000000';
  const strokeWidth = typeof (data as any)?.strokeWidth === 'number' ? (data as any).strokeWidth : 2;

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
          <div className="w-6 h-6 bg-[var(--node-geometry)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <Palette size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {data?.identifier?.displayName ?? 'Canvas'}
            </div>
            <div className="text-xs text-[var(--text-tertiary)] font-mono">
              {(data?.identifier?.id ?? '').split('_').pop()}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Position:</span>
          <span className="text-[var(--text-primary)] font-medium">({position.x}, {position.y})</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Rotation:</span>
          <span className="text-[var(--text-primary)] font-medium">{rotation} rad</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Scale:</span>
          <span className="text-[var(--text-primary)] font-medium">{scale.x}×{scale.y}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Opacity:</span>
          <span className="text-[var(--text-primary)] font-medium">{Math.round(opacity * 100)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Fill/Stroke:</span>
          <div className="flex items-center gap-[var(--space-2)]">
            <div className="w-4 h-4 rounded border border-[var(--border-primary)]" style={{ backgroundColor: fillColor }} />
            <div className="w-4 h-4 rounded border border-[var(--border-primary)]" style={{ backgroundColor: strokeColor }} />
            <span className="text-[var(--text-primary)] font-medium text-xs">{strokeWidth}px</span>
          </div>
        </div>
        <div className="text-[var(--text-tertiary)] text-[10px] pt-1">Defaults and bindings can be configured in Canvas tab</div>
      </CardContent>
    </Card>
  );
}