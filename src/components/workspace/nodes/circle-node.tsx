// src/components/workspace/nodes/circle-node.tsx - Simplified single output port
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { CircleNodeData } from "@/shared/types/nodes";

export function CircleNode({ data, selected }: NodeProps<CircleNodeData>) {
  const nodeDefinition = getNodeDefinition('circle');
  
  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div 
            className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-primary)] font-bold"
            style={{ backgroundColor: data.color }}
          >
            ●
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-1 text-xs text-[var(--text-secondary)]">
        <div>Radius: {data.radius}px</div>
        <div>Position: ({data.position.x}, {data.position.y})</div>
        <div className="flex items-center gap-[var(--space-2)]">
          <span>Color:</span>
          <div 
            className="w-4 h-4 rounded-full border border-[var(--border-primary)]"
            style={{ backgroundColor: data.color }}
          />
        </div>
      </CardContent>

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 bg-[var(--node-geometry)] !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}