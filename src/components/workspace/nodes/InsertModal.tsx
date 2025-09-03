"use client";

import React, { useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { NumberField } from "@/components/ui/form-fields";
import { Button } from "@/components/ui/button";
import { BindButton } from "@/components/workspace/binding/bindings";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { FlowTracker } from "@/lib/flow/flow-tracking";
import type { NodeData, InsertNodeData } from "@/shared/types/nodes";

export function InsertModal({
  isOpen,
  onClose,
  nodeId,
}: {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
}) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find(
    (n) => n.data?.identifier?.id === nodeId,
  );
  const data = (node?.data ?? {}) as unknown as InsertNodeData & {
    appearanceTimeByObject?: Record<string, number>;
    variableBindings?: Record<string, { boundResultNodeId?: string }>;
    variableBindingsByObject?: Record<
      string,
      Record<string, { boundResultNodeId?: string }>
    >;
  };

  const defaultTime = Number(data.appearanceTime ?? 0);
  const isDefaultBound = !!data.variableBindings?.appearanceTime?.boundResultNodeId;

  const objects = useMemo(() => {
    const tracker = new FlowTracker();
    return tracker.getUpstreamObjects(
      nodeId,
      state.flow.nodes,
      state.flow.edges,
    );
  }, [nodeId, state.flow.nodes, state.flow.edges]);

  const setDefaultTime = (value: number) => {
    updateFlow({
      nodes: state.flow.nodes.map((n) =>
        n.data?.identifier?.id !== nodeId
          ? n
          : ({
              ...n,
              data: { ...n.data, appearanceTime: value } as NodeData,
            } as typeof n),
      ),
    });
    // Notify FlowEditorTab to sync its local nodes to prevent snap-back overwrite
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(
          "insert-appearance-time-updated",
          {
            detail: {
              nodeIdentifierId: nodeId,
              defaultTime: value,
            },
          },
        ),
      );
    }
  };

  const resetDefaultTime = () => setDefaultTime(0);

  const setPerObjectTime = (objectId: string, value: number) => {
    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (n.data?.identifier?.id !== nodeId) return n;
        const prev = (n.data as InsertNodeData).appearanceTimeByObject ?? {};
        return {
          ...n,
          data: {
            ...n.data,
            appearanceTimeByObject: { ...prev, [objectId]: value },
          } as NodeData,
        };
      }),
    });
    // Notify FlowEditorTab to sync its local nodes to prevent snap-back overwrite
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(
          "insert-appearance-time-updated",
          {
            detail: {
              nodeIdentifierId: nodeId,
              objectId,
              time: value,
            },
          },
        ),
      );
    }
  };

  const clearPerObjectTime = (objectId: string) => {
    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (n.data?.identifier?.id !== nodeId) return n;
        const prev =
          ((n.data as InsertNodeData).appearanceTimeByObject ?? {}) as Record<
            string,
            number
          >;
        const next = { ...prev };
        delete next[objectId];
        return {
          ...n,
          data: {
            ...n.data,
            ...(Object.keys(next).length > 0
              ? { appearanceTimeByObject: next }
              : { appearanceTimeByObject: undefined }),
          } as NodeData,
        };
      }),
    });
    // Notify FlowEditorTab to sync its local nodes to prevent snap-back overwrite
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(
          "insert-appearance-time-updated",
          {
            detail: {
              nodeIdentifierId: nodeId,
              objectId,
              clear: true,
            },
          },
        ),
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Insert: Appearance Time" size="lg">
      <div className="p-[var(--space-4)]">
        <div className="mb-[var(--space-4)] grid grid-cols-2 gap-[var(--space-4)]">
          <div>
            <NumberField
              label="Default appearance time (seconds)"
              value={defaultTime}
              onChange={(v) => setDefaultTime(v)}
              min={0}
              step={0.1}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="appearanceTime" />}
              disabled={isDefaultBound}
            />
            <div className="mt-[var(--space-2)] text-right">
              <Button variant="ghost" size="sm" onClick={resetDefaultTime}>
                Reset to 0
              </Button>
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Set when objects become visible. Default applies to all objects unless a per-object value or binding is set. Bound values come from Result nodes.
          </div>
        </div>

        <div className="text-sm font-semibold text-[var(--text-secondary)]">
          Per-object appearance times
        </div>

        <div className="mt-[var(--space-2)] grid grid-cols-2 gap-[var(--space-4)]">
          <div className="text-xs text-[var(--text-tertiary)]">Object</div>
          <div className="text-xs text-[var(--text-tertiary)]">Time (s)</div>
        </div>

        <div className="mt-[var(--space-2)] max-h-[420px] space-y-[var(--space-2)] overflow-auto pr-[var(--space-1)]">
          {objects.length === 0 ? (
            <div className="rounded border border-[var(--border-secondary)] p-[var(--space-3)] text-xs text-[var(--text-tertiary)]">
              No upstream objects connected to this Insert node.
            </div>
          ) : (
            objects.map((obj) => {
              const perObjectBindingId = data.variableBindingsByObject?.[obj.id]?.appearanceTime?.boundResultNodeId;
              const isBound = !!perObjectBindingId;
              const value = data.appearanceTimeByObject?.[obj.id];
              return (
                <div
                  key={obj.id}
                  className="grid grid-cols-2 items-center gap-[var(--space-4)] rounded border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-2)] py-[var(--space-1)]"
                >
                  <div className="truncate text-sm text-[var(--text-primary)]" title={obj.displayName}>
                    {obj.displayName}
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    <div className="flex-1">
                      <NumberField
                        label=""
                        value={value}
                        onChange={(v) => setPerObjectTime(obj.id, v)}
                        min={0}
                        step={0.1}
                        bindAdornment={<BindButton nodeId={nodeId} bindingKey="appearanceTime" objectId={obj.id} />}
                        disabled={isBound}
                      />
                    </div>
                    {value !== undefined && (
                      <Button variant="ghost" size="xs" onClick={() => clearPerObjectTime(obj.id)}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-[var(--space-3)] text-right text-[10px] text-[var(--text-tertiary)]">
          Changes apply immediately. Use Save to persist your workspace.
        </div>
      </div>
    </Modal>
  );
}

