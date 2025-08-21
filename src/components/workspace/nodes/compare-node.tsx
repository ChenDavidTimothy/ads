// src/components/workspace/nodes/compare-node.tsx - Compare logic node
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { CompareNodeData } from "@/shared/types/nodes";
import { Equal } from "lucide-react";

export function CompareNode({ data, selected }: NodeProps<CompareNodeData>) {
  const nodeDefinition = getNodeDefinition("compare");

  const getOperatorSymbol = () => {
    switch (data.operator) {
      case "gt":
        return ">";
      case "lt":
        return "<";
      case "eq":
        return "==";
      case "neq":
        return "!=";
      case "gte":
        return ">=";
      case "lte":
        return "<=";
    }
  };

  const getOperatorLabel = () => {
    switch (data.operator) {
      case "gt":
        return "Greater than";
      case "lt":
        return "Less than";
      case "eq":
        return "Equal";
      case "neq":
        return "Not equal";
      case "gte":
        return "Greater or equal";
      case "lte":
        return "Less or equal";
    }
  };

  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] p-[var(--card-padding)]"
    >
      {/* Input ports */}
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
            <Equal size={12} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-0">
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-2 text-center">
          <div className="font-mono text-lg text-[var(--text-primary)]">
            A {getOperatorSymbol()} B
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">
            Operation:
          </span>
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {getOperatorLabel()}
          </span>
        </div>

        <div className="text-center text-xs">
          <span className="rounded-[var(--radius-sm)] bg-[var(--success-100)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--success-700)]">
            Boolean Output
          </span>
        </div>

        <div className="mt-3 border-t border-[var(--border-primary)] pt-2">
          <div className="text-center text-xs text-[var(--text-tertiary)]">
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
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: "50%" }}
        />
      ))}
    </Card>
  );
}
