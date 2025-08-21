// src/components/workspace/flow/hooks/use-result-log-viewer.ts
import { useState, useCallback, useMemo } from "react";
import type { Node } from "reactflow";
import type { NodeData } from "@/shared/types";

export interface ResultLogModalState {
  isOpen: boolean;
  nodeId: string | null;
}

export function useResultLogViewer(nodes: Node<NodeData>[]) {
  const [resultLogModalState, setResultLogModalState] =
    useState<ResultLogModalState>({
      isOpen: false,
      nodeId: null,
    });

  const handleOpenResultLogViewer = useCallback((nodeId: string) => {
    setResultLogModalState({ isOpen: true, nodeId });
  }, []);

  const handleCloseResultLogViewer = useCallback(() => {
    setResultLogModalState({ isOpen: false, nodeId: null });
  }, []);

  const resultNode = useMemo(
    () =>
      resultLogModalState.nodeId
        ? (nodes.find(
            (n) => n.data.identifier.id === resultLogModalState.nodeId,
          ) ?? null)
        : null,
    [nodes, resultLogModalState.nodeId],
  );

  const getResultNodeData = useCallback(() => {
    if (!resultNode)
      return {
        name: "Unknown Result Node",
        label: "Debug Output",
      };

    const data = resultNode.data as unknown as Partial<{
      identifier: { displayName: string };
      label: string;
    }>;

    return {
      name: (data as { identifier: { displayName: string } }).identifier
        .displayName,
      label: typeof data.label === "string" ? data.label : "Debug Output",
    };
  }, [resultNode]);

  return {
    resultLogModalState,
    setResultLogModalState,
    handleOpenResultLogViewer,
    handleCloseResultLogViewer,
    resultNode,
    getResultNodeData,
  } as const;
}
