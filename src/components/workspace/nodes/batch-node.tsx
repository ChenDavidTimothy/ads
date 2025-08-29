"use client";

import React from "react";
import type { Node } from "reactflow";
import type { NodeData } from "@/shared/types/nodes";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Input } from "@/components/ui/input";
import { BindButton } from "@/components/workspace/binding/bindings";

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

  return (
    <div className="min-w-[220px] rounded-md border border-[var(--border-primary)] bg-[var(--surface-1)] p-3 text-[var(--text-primary)]">
      <div className="mb-2 font-medium">Batch</div>
      <div className="space-y-2">
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
          <div className="text-[10px] text-[var(--text-tertiary)]">
            Bound (overrides disabled)
          </div>
        ) : null}
      </div>
    </div>
  );
}

