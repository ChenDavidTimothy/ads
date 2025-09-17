// src/components/workspace/nodes/if-else-node.tsx - If/Else logic node
'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

import type { IfElseNodeData } from '@/shared/types/nodes';
import { GitBranch } from 'lucide-react';

export function IfElseNode({ data, selected }: NodeProps<IfElseNodeData>) {
  const handleClass = 'bg-[var(--node-logic)]';

  return (
    <Card selected={selected} className="min-w-[var(--node-min-width)] p-[var(--card-padding)]">
      {/* Condition input port */}
      <Handle
        type="target"
        position={Position.Left}
        id="condition"
        className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
        style={{ top: '35%' }}
      />

      {/* Data input port */}
      <Handle
        type="target"
        position={Position.Left}
        id="data"
        className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
        style={{ top: '65%' }}
      />

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-logic)] text-[var(--text-primary)]">
            <GitBranch size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-0">
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-2 text-center">
          <div className="text-sm text-[var(--text-primary)]">
            if condition → route data to true / else → false
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="text-center text-[var(--success-500)]">True</div>
          <div className="text-center text-[var(--danger-500)]">False</div>
        </div>

        <div className="text-center text-xs">
          <span className="rounded-[var(--radius-sm)] bg-[var(--accent-100)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--accent-900)]">
            Data Router
          </span>
        </div>

        <div className="mt-3 border-t border-[var(--border-primary)] pt-2">
          <div className="text-center text-xs text-[var(--text-tertiary)]">
            Condition + Data → Routed Data
          </div>
        </div>
      </CardContent>

      {/* Output ports */}
      <Handle
        type="source"
        position={Position.Right}
        id="true_path"
        className={`h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--success-500)]`}
        style={{ top: '35%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false_path"
        className={`h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--danger-500)]`}
        style={{ top: '65%' }}
      />
    </Card>
  );
}
