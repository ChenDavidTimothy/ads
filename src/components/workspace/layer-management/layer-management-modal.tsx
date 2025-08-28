"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/form-fields";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { FlowTracker } from "@/lib/flow/flow-tracking";
import type { Node } from "reactflow";
import type { NodeData } from "@/shared/types";
import { reconcileLayerOrder, formatSceneLabel } from "./layer-management-utils";
import { DraggableObjectList } from "./draggable-object-list";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LayerManagementModal({ isOpen, onClose }: Props) {
  const { state, updateFlow } = useWorkspace();
  const [selectedSceneId, setSelectedSceneId] = useState<string | "">("");

  const { sceneNodes, frameNodes } = useMemo(() => {
    const sceneNodes = state.flow.nodes.filter((n) => n.type === "scene");
    const frameNodes = state.flow.nodes.filter((n) => n.type === "frame");
    return { sceneNodes, frameNodes } as {
      sceneNodes: Node<NodeData>[];
      frameNodes: Node<NodeData>[];
    };
  }, [state.flow.nodes]);

  const allTargets = useMemo(() => [...sceneNodes, ...frameNodes], [sceneNodes, frameNodes]);

  const options = useMemo(() => {
    const tracker = new FlowTracker();
    return allTargets.map((node) => {
      const objects = tracker.getUpstreamObjects(
        node.data.identifier.id,
        state.flow.nodes,
        state.flow.edges,
      );
      return {
        id: node.data.identifier.id,
        label: formatSceneLabel(
          node.data.identifier.displayName,
          (node.type as "scene" | "frame") ?? "scene",
          objects.length,
        ),
        count: objects.length,
      };
    });
  }, [allTargets, state.flow.nodes, state.flow.edges]);

  const selectedNode = useMemo(() => {
    if (!selectedSceneId) return undefined;
    return allTargets.find((n) => n.data.identifier.id === selectedSceneId);
  }, [selectedSceneId, allTargets]);

  const objectList = useMemo(() => {
    if (!selectedNode) return [] as { id: string; displayName: string; type: string }[];
    const tracker = new FlowTracker();
    const objects = tracker.getUpstreamObjects(
      selectedNode.data.identifier.id,
      state.flow.nodes,
      state.flow.edges,
    );
    return objects.map((o) => ({ id: o.id, displayName: o.displayName, type: o.type }));
  }, [selectedNode, state.flow.nodes, state.flow.edges]);

  // Local optimistic order to prevent snap-back during drag
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const lastCommittedRef = useRef<string[] | null>(null);

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  // Reconcile and seed local order whenever target or objects change
  useEffect(() => {
    if (!selectedNode) {
      setLocalOrder([]);
      lastCommittedRef.current = null;
      return;
    }
    const saved = (selectedNode.data as unknown as { layerOrder?: string[] }).layerOrder;
    const ids = objectList.map((o) => o.id);
    const reconciled = reconcileLayerOrder(ids, saved);

    // If we just committed this same order, skip a reseed (prevents flicker)
    if (lastCommittedRef.current && arraysEqual(reconciled, lastCommittedRef.current)) {
      lastCommittedRef.current = null;
      return;
    }

    // Reseed only if object IDs changed or local differs from reconciled
    const localIdsChanged =
      localOrder.length !== ids.length || !ids.every((id) => localOrder.includes(id));

    if (localIdsChanged || !arraysEqual(localOrder, reconciled)) {
      setLocalOrder(reconciled);
    }
  }, [selectedNode, objectList]);

  const handleReorder = (newOrder: string[]) => {
    if (!selectedNode) return;
    // Optimistically update UI first to avoid flicker
    setLocalOrder(newOrder);
    lastCommittedRef.current = newOrder;
    const targetIdentifierId = selectedNode.data.identifier.id;
    const updatedNodes = state.flow.nodes.map((n) => {
      const nid = (n.data as unknown as { identifier?: { id?: string } })?.identifier?.id;
      if (nid !== targetIdentifierId) return n;
      const data = (n.data as unknown as Record<string, unknown>) || {};
      return {
        ...n,
        data: { ...data, layerOrder: [...newOrder] } as unknown,
      } as typeof n;
    });
    updateFlow({ nodes: updatedNodes });

    // Notify FlowEditorTab to sync its local nodes to prevent snap-back overwrite
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("layer-order-updated", {
          detail: { nodeIdentifierId: targetIdentifierId, order: [...newOrder] },
        }),
      );
    }
  };

  const handleSelect = (value: string) => {
    setSelectedSceneId(value);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Layers" size="md" variant="glass">
      <div className="flex h-full flex-col p-[var(--space-4)]">
        <div className="mb-[var(--space-3)]">
          <SelectField
            label={<span className="text-[12px] text-[var(--text-secondary)]">Scene or Frame</span>}
            value={selectedSceneId}
            onChange={handleSelect}
            options={[{ value: "", label: "Select a scene or frame…" }, ...options.map((o) => ({ value: o.id, label: o.label }))]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden">
          {!selectedSceneId ? (
            <div className="flex h-full items-center justify-center text-center text-[var(--text-tertiary)]">
              <div>
                <div className="mb-2">Select a scene or frame to manage its layers</div>
                <div className="text-xs">Choose from the dropdown above</div>
              </div>
            </div>
          ) : (
            <DraggableObjectList objects={objectList} currentOrder={localOrder} onReorder={handleReorder} />
          )}
        </div>

        <div className="mt-[var(--space-3)] text-right text-[10px] text-[var(--text-tertiary)]">
          Changes update your workspace immediately. Use Save to persist.
        </div>
      </div>
    </Modal>
  );
}


