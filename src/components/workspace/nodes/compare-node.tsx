// src/components/workspace/nodes/compare-node.tsx - Compare logic node
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { CompareNodeData } from "@/shared/types/nodes";
import { Equal } from "lucide-react";

export function CompareNode({ data, selected }: NodeProps<CompareNodeData>) {
  const nodeDefinition = getNodeDefinition('compare');
  
  const getOperatorSymbol = () => {
    switch (data.operator) {
      case 'gt': return '>';
      case 'lt': return '<';
      case 'eq': return '==';
      case 'neq': return '!=';
      case 'gte': return '>=';
      case 'lte': return '<=';
    }
  };

  const getOperatorLabel = () => {
    switch (data.operator) {
      case 'gt': return 'Greater than';
      case 'lt': return 'Less than';
      case 'eq': return 'Equal';
      case 'neq': return 'Not equal';
      case 'gte': return 'Greater or equal';
      case 'lte': return 'Less or equal';
    }
  };

  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      {/* Input ports */}
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `${35 + (index * 30)}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-logic)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <Equal size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="bg-[var(--surface-2)] p-2 rounded border border-[var(--border-primary)] text-center">
          <div className="text-lg text-[var(--text-primary)] font-mono">
            A {getOperatorSymbol()} B
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Operation:</span>
          <span className="text-xs text-[var(--text-primary)] font-medium">
            {getOperatorLabel()}
          </span>
        </div>

        <div className="text-xs text-center">
          <span className="bg-[var(--success-100)] text-[var(--success-700)] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)]">
            Boolean Output
          </span>
        </div>

        <div className="mt-3 pt-2 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)] text-center">
            Type-Safe Comparison
          </div>
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
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}
