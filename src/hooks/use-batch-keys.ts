"use client";

import { useMemo } from "react";
import type { Node } from "reactflow";
import { useWorkspace } from "@/components/workspace/workspace-context";

interface NodeData {
  identifier?: {
    id: string;
  };
  keys?: string[];
}

interface BatchKeysResult {
  keys: string[];
  hasBatchKeys: boolean;
}

/**
 * Returns the union of upstream Batch node keys for the given node.
 * If objectId is provided, returns only keys from batch nodes that the specific object has passed through.
 * Phase 1 heuristic: graph traversal only; does not attempt per-object reachability.
 */
export function useBatchKeysForField(
  nodeId: string,
  _fieldPath: string,
  objectId?: string,
): BatchKeysResult {
  const { state } = useWorkspace();

  return useMemo(() => {
    const nodes = state.flow.nodes;
    const edges = state.flow.edges;

    // Debug logging
    console.log("[useBatchKeysForField] Debug:", {
      nodeId,
      objectId,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeTypes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        identifierId: (n.data as NodeData)?.identifier?.id,
      })),
    });

    // Build adjacency of incoming edges by canonical identifier id
    const idToNode = new Map<string, Node>();
    for (const n of nodes) {
      const identifierId = (n.data as NodeData)?.identifier?.id ?? n.id;
      idToNode.set(identifierId, n);
      idToNode.set(n.id, n);
    }

    const start = idToNode.has(nodeId)
      ? nodeId
      : (idToNode.get(nodeId)?.id ?? nodeId);
    const keys = new Set<string>();

    if (!objectId) {
      // Legacy behavior: find all upstream batch nodes from the editor node
      const visited = new Set<string>();

      const incomingOf = (targetId: string) =>
        edges.filter(
          (e) =>
            e.target === targetId ||
            e.target === (idToNode.get(targetId)?.id ?? targetId),
        );

      const dfs = (cur: string) => {
        if (visited.has(cur)) return;
        visited.add(cur);
        const n = idToNode.get(cur);
        if (!n) return;

        const nodeData = (n.data as Record<string, unknown>) ?? {};
        console.log("[useBatchKeysForField] Checking node:", {
          id: cur,
          type: n.type,
          data: JSON.parse(JSON.stringify(nodeData)) as Record<string, unknown>,
        });

        if (n.type === "batch") {
          const data = (n.data as NodeData) ?? {};
          const arr = Array.isArray(data.keys) ? data.keys : [];
          console.log(
            "[useBatchKeysForField] Found batch node with keys:",
            arr,
          );
          for (const k of arr)
            if (typeof k === "string" && k.trim()) keys.add(k.trim());
        }

        const incomings = incomingOf(cur);
        console.log(
          "[useBatchKeysForField] Incoming edges for",
          cur,
          ":",
          incomings,
        );

        for (const e of incomings) {
          const src = e.source;
          const srcNode = idToNode.get(src);
          const next = (srcNode?.data as NodeData)?.identifier?.id ?? src;
          dfs(next);
        }
      };

      dfs(start);
    } else {
      // Object-specific behavior: trace the object's path from source to editor
      console.log("[useBatchKeysForField] Tracing object path for:", objectId);

      // Find the object's path from its source to the editor node
      const objectVisited = new Set<string>();
      const stack = [objectId];

      while (stack.length > 0) {
        const currentId = stack.pop()!;
        if (objectVisited.has(currentId)) continue;
        objectVisited.add(currentId);

        const currentNode = idToNode.get(currentId);
        if (!currentNode) continue;

        const currentNodeData =
          (currentNode.data as Record<string, unknown>) ?? {};
        console.log("[useBatchKeysForField] Object path through:", {
          id: currentId,
          type: currentNode.type,
          data: JSON.parse(JSON.stringify(currentNodeData)) as Record<
            string,
            unknown
          >,
        });

        // If this is a batch node that the object passes through, collect its keys
        if (currentNode.type === "batch") {
          const data = (currentNode.data as NodeData) ?? {};
          const arr = Array.isArray(data.keys) ? data.keys : [];
          console.log(
            "[useBatchKeysForField] Object",
            objectId,
            "passed through batch node",
            currentId,
            "with keys:",
            arr,
          );
          for (const k of arr)
            if (typeof k === "string" && k.trim()) keys.add(k.trim());
        }

        // Find outgoing edges from this node to continue tracing the object's path
        const outgoingEdges = edges.filter(
          (e) =>
            e.source === currentId ||
            e.source === (currentNode.data as NodeData)?.identifier?.id,
        );

        for (const edge of outgoingEdges) {
          const targetNode = idToNode.get(edge.target);
          const targetId =
            (targetNode?.data as NodeData)?.identifier?.id ?? edge.target;
          if (!objectVisited.has(targetId)) {
            stack.push(targetId);
          }
        }
      }
    }

    const list = Array.from(keys).sort((a, b) => a.localeCompare(b));
    console.log("[useBatchKeysForField] Final result:", {
      keys: list,
      hasBatchKeys: list.length > 0,
      objectId,
    });
    return { keys: list, hasBatchKeys: list.length > 0 };
  }, [state.flow.nodes, state.flow.edges, nodeId, objectId]);
}
