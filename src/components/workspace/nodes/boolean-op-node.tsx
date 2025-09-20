// src/components/workspace/nodes/boolean-op-node.tsx - Boolean operation logic node
'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { getNodeDefinitionWithDynamicPorts } from '@/shared/registry/registry-utils';
import type { BooleanOpNodeData } from '@/shared/types/nodes';
import { Binary } from 'lucide-react';

export function BooleanOpNode({ data, selected }: NodeProps<BooleanOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts(
    'boolean_op',
    data as unknown as Record<string, unknown>
  );

  const getOperatorDisplay = () => {
    switch (data.operator) {
      case 'and':
        return 'AND';
      case 'or':
        return 'OR';
      case 'not':
        return 'NOT';
      case 'xor':
        return 'XOR';
    }
  };

  const getOperatorSymbol = () => {
    switch (data.operator) {
      case 'and':
        return '∧';
      case 'or':
        return '∨';
      case 'not':
        return '¬';
      case 'xor':
        return '⊕';
    }
  };

  const handleClass = 'bg-[var(--node-logic)]';

  return (
    <Card selected={selected} className="min-w-[var(--node-min-width)] p-[var(--card-padding)]">
      {/* Dynamic input ports */}
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `${35 + index * 30}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-logic)] text-[var(--text-primary)]">
            <Binary size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-0">
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-2 text-center">
          <div className="font-mono text-sm text-[var(--text-primary)]">
            Bool ({getOperatorDisplay()})
          </div>
          <div className="mt-1 font-mono text-lg text-[var(--text-primary)]">
            {data.operator === 'not' ? `${getOperatorSymbol()}A` : `A ${getOperatorSymbol()} B`}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Operation:</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {getOperatorDisplay()}
          </span>
        </div>

        <div className="text-center text-xs">
          <span className="rounded-[var(--radius-sm)] bg-[var(--accent-100)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--accent-900)]">
            Boolean Logic
          </span>
        </div>

        <div className="mt-3 border-t border-[var(--border-primary)] pt-2">
          <div className="text-center text-xs text-[var(--text-tertiary)]">
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
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}
