"use client";

import React from "react";
import { Handle, Position } from "reactflow";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Input } from "@/components/ui/input";
import { BindButton } from "@/components/workspace/binding/bindings";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { getNodeDefinition } from "@/shared/registry/registry-utils";

export function BatchNode({ id }: { id: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find((n) => n.id === id);
  const nodeId = node?.data?.identifier?.id ?? id;

  const data = (node?.data ?? {}) as unknown as Record<string, unknown> & {
    key?: string;
    keys?: string[];
    variableBindings?: Record<string, { boundResultNodeId?: string }>;
  };
  const keyVal = typeof data.key === "string" ? data.key : "";
  const keys = Array.isArray(data.keys)
    ? (data.keys as unknown[]).filter((k) => typeof k === "string")
    : [];
  const isBound = Boolean(data.variableBindings?.key?.boundResultNodeId);
  const [open, setOpen] = React.useState(false);
  const [localInput, setLocalInput] = React.useState("");

  const nodeDefinition = getNodeDefinition("batch");
  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card
      className="min-w-[var(--node-min-width)] p-[var(--card-padding)]"
      onDoubleClick={() => setOpen(true)}
    >
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-logic)] text-[var(--text-primary)]">
            <span role="img" aria-label="batch">
              🏷️
            </span>
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {node?.data?.identifier?.displayName ?? "Batch"}
          </span>
          <span className="ml-auto text-[10px] text-[var(--text-secondary)]">
            {keys.length} keys
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-0">
        <div className="flex items-center gap-[var(--space-2)]">
          <Button variant="outline" onClick={() => setOpen(true)}>
            Keys
          </Button>
          <div className="text-[10px] text-[var(--text-tertiary)]">
            Manage keys
          </div>
        </div>
      </CardContent>

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ))}

      {open ? (
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Batch Keys"
          size="sm"
        >
          <div className="p-[var(--space-4)]">
            <div className="mb-[var(--space-2)] text-[12px] text-[var(--text-secondary)]">
              Add or remove keys
            </div>
            <div className="flex gap-[var(--space-2)]">
              <Input
                placeholder="Enter key"
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
              />
              <Button
                onClick={() => {
                  const v = localInput.trim();
                  if (!v) return;
                  if (keys.includes(v)) return; // prevent duplicates
                  const nextKeys = [...keys, v];
                  // Autosave like layer modal: update flow immediately
                  updateFlow({
                    nodes: state.flow.nodes.map((n) =>
                      n.id !== id
                        ? n
                        : ({
                            ...n,
                            data: { ...(n.data as Record<string, unknown>), keys: nextKeys },
                          } as typeof n),
                    ),
                  });
                  // Notify FlowEditorTab to sync its local nodes to prevent snap-back overwrite
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("batch-keys-updated", {
                        detail: {
                          nodeIdentifierId: nodeId,
                          keys: [...nextKeys],
                        },
                      }),
                    );
                  }
                  setLocalInput("");
                }}
              >
                Add
              </Button>
            </div>

            <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
              {keys.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">
                  No keys yet.
                </div>
              ) : (
                keys.map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded border border-[var(--border)] px-[var(--space-2)] py-[var(--space-1)]"
                  >
                    <div className="text-[12px]">{k}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const nextKeys = keys.filter((x) => x !== k);
                        updateFlow({
                          nodes: state.flow.nodes.map((n) =>
                            n.id !== id
                              ? n
                              : ({
                                  ...n,
                                  data: { ...(n.data as Record<string, unknown>), keys: nextKeys },
                                } as typeof n),
                          ),
                        });
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("batch-keys-updated", {
                              detail: {
                                nodeIdentifierId: nodeId,
                                keys: [...nextKeys],
                              },
                            }),
                          );
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-[var(--space-3)] text-right text-[10px] text-[var(--text-tertiary)]">
              Changes update your workspace immediately. Use Save to persist.
            </div>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}
