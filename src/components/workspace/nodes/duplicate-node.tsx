"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { DuplicateNodeData } from "@/shared/types/nodes";
import { Copy } from "lucide-react";

export function DuplicateNode({ data, selected }: NodeProps<DuplicateNodeData>) {
  const nodeDefinition = getNodeDefinition('duplicate');
  
  const getPatternLabel = (pattern: string) => {
    switch (pattern) {
      case 'linear': return 'Linear';
      case 'grid': return 'Grid';
      default: return 'None';
    }
  };

  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      {/* Input port */}
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
          <div className="w-6 h-6 bg-[var(--node-logic)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <Copy size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Count:</span>
          <span className="text-xs text-[var(--text-primary)] font-medium">{data.count}</span>
        </div>
        
        {data.pattern !== 'none' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Pattern:</span>
              <span className="text-xs text-[var(--text-primary)] font-medium">{getPatternLabel(data.pattern)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Spacing:</span>
              <span className="text-xs text-[var(--text-primary)] font-medium">{data.spacing}px</span>
            </div>
          </>
        )}
        
        <div className="text-xs text-[var(--success-500)]">
          {data.count === 1 ? 'Pass-through mode' : `Creating ${data.count - 1} duplicate${data.count > 2 ? 's' : ''}`}
        </div>
      </CardContent>

      {/* Output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}
