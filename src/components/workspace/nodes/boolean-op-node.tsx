// src/components/workspace/nodes/boolean-op-node.tsx - Boolean operation logic node
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinitionWithDynamicPorts } from "@/shared/registry/registry-utils";
import type { BooleanOpNodeData } from "@/shared/types/nodes";

export function BooleanOpNode({ data, selected }: NodeProps<BooleanOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts('boolean_op', data as unknown as Record<string, unknown>);
  
  const getOperatorDisplay = () => {
    switch (data.operator) {
      case 'and': return 'AND';
      case 'or': return 'OR';
      case 'not': return 'NOT';
      case 'xor': return 'XOR';
    }
  };

  const getOperatorSymbol = () => {
    switch (data.operator) {
      case 'and': return '∧';
      case 'or': return '∨';
      case 'not': return '¬';
      case 'xor': return '⊕';
    }
  };

  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      {/* Dynamic input ports */}
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

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--node-logic)] flex items-center justify-center rounded text-[var(--text-primary)] font-bold text-sm">
            ⊙
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="bg-[var(--surface-2)] p-2 rounded border border-[var(--border-primary)] text-center">
          <div className="text-sm font-mono text-[var(--text-primary)]">
            Bool ({getOperatorDisplay()})
          </div>
          <div className="text-lg text-[var(--text-primary)] font-mono mt-1">
            {data.operator === 'not' ? `${getOperatorSymbol()}A` : `A ${getOperatorSymbol()} B`}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Operation:</span>
          <span className="text-xs text-[var(--text-primary)] font-medium">
            {getOperatorDisplay()}
          </span>
        </div>

        <div className="text-xs text-center">
          <span className="bg-[var(--accent-100)] text-[var(--accent-900)] px-2 py-1 rounded">
            Boolean Logic
          </span>
        </div>

        <div className="mt-3 pt-2 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)] text-center">
            {data.operator === 'not' ? '1 Input' : '2 Inputs'} → Boolean
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
