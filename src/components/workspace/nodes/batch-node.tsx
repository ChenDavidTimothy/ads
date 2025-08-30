"use client";

import React from "react";
import { Handle, Position } from "reactflow";
import type { Node } from "reactflow";
import type { NodeData } from "@/shared/types/nodes";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Input } from "@/components/ui/input";
import { BindButton } from "@/components/workspace/binding/bindings";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";

export function BatchNode({ id }: { id: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find((n) => n.id === id) as
    | Node<NodeData>
    | undefined;
  const nodeId = node?.data?.identifier?.id ?? id;

  const data = (node?.data ?? {}) as unknown as Record<string, unknown> & {
    key?: string;
    variableBindings?: Record<string, { boundResultNodeId?: string }>;
  };
  const keyVal = typeof data.key === "string" ? data.key : "";
  const isBound = Boolean(data.variableBindings?.key?.boundResultNodeId);

  const nodeDefinition = getNodeDefinition("batch");
  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card className="min-w-[var(--node-min-width)] p-[var(--card-padding)]">
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-logic)] text-[var(--text-primary)]">
            <span role="img" aria-label="batch">🏷️</span>
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {node?.data?.identifier?.displayName ?? "Batch"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-0">
        <div className="text-xs text-[var(--text-secondary)]">Key</div>
        <Input
          value={keyVal}
          onChange={(e) => {
            const next = e.target.value;
            updateFlow({
              nodes: state.flow.nodes.map((n) =>
                n.id !== id ? n : { ...n, data: { ...n.data, key: next } },
              ),
            });
          }}
          disabled={isBound}
          endAdornment={<BindButton nodeId={nodeId} bindingKey="key" />}
        />
        {isBound ? (
          <div className="text-[10px] text-[var(--text-tertiary)]">Bound (overrides disabled)</div>
        ) : null}
      </CardContent>

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}

