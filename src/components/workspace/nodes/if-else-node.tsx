// src/components/workspace/nodes/if-else-node.tsx - If/Else logic node
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

import type { IfElseNodeData } from "@/shared/types/nodes";
import { GitBranch } from "lucide-react";

export function IfElseNode({ data, selected }: NodeProps<IfElseNodeData>) {

  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      {/* Condition input port */}
      <Handle
        type="target"
        position={Position.Left}
        id="condition"
        className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
        style={{ top: '35%' }}
      />

      {/* Data input port */}
      <Handle
        type="target"
        position={Position.Left}
        id="data"
        className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
        style={{ top: '65%' }}
      />

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-logic)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <GitBranch size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="bg-[var(--surface-2)] p-2 rounded border border-[var(--border-primary)] text-center">
          <div className="text-sm text-[var(--text-primary)]">
            if condition → route data to true / else → false
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="text-[var(--success-500)] text-center">True</div>
          <div className="text-[var(--danger-500)] text-center">False</div>
        </div>

        <div className="text-xs text-center">
          <span className="bg-[var(--accent-100)] text-[var(--accent-900)] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)]">Data Router</span>
        </div>

        <div className="mt-3 pt-2 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)] text-center">Condition + Data → Routed Data</div>
        </div>
      </CardContent>

      {/* Output ports */}
      <Handle
        type="source"
        position={Position.Right}
        id="true_path"
        className={`w-3 h-3 bg-[var(--success-500)] !border-2 !border-[var(--text-primary)]`}
        style={{ top: '35%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false_path"
        className={`w-3 h-3 bg-[var(--danger-500)] !border-2 !border-[var(--text-primary)]`}
        style={{ top: '65%' }}
      />
    </Card>
  );
}
