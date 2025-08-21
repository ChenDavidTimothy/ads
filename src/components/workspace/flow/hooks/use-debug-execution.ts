import { useCallback, useState } from "react";
import { api } from "@/trpc/react";
import { useNotifications } from "@/hooks/use-notifications";
import type { NodeData } from "@/shared/types";
import { logger } from "@/lib/logger";

// Minimal local types to avoid dependency on reactflow types at build time
type RFEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};
type RFNode<T> = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: T;
};

interface DebugResult {
  value: unknown;
  type: string;
  timestamp: number;
  executionId?: string;
  flowState?: string;
  hasConnections?: boolean;
  inputCount?: number;
}

export function useDebugExecution(nodes: RFNode<NodeData>[], edges: RFEdge[]) {
  const [debugResults, setDebugResults] = useState<Map<string, DebugResult[]>>(
    new Map(),
  );
  const { toast } = useNotifications();

  const debugToNode = api.animation.debugToNode.useMutation({
    onSuccess: (data) => {
      // Handle failed debug execution with validation errors
      if (!data.success && data.error) {
        toast.error("Debug validation failed", data.error);
        if (data.suggestions && data.suggestions.length > 0) {
          // Show suggestions as additional info
          setTimeout(() => {
            toast.info("Suggestions", data.suggestions.join(" • "));
          }, 1000);
        }
        return;
      }

      if (data.debugLogs && data.debugLogs.length > 0) {
        setDebugResults((prevResults) => {
          const newResults = new Map(prevResults);

          data.debugLogs.forEach((log) => {
            if (log.data && typeof log.data === "object" && log.data !== null) {
              const logData = log.data as {
                type?: string;
                value?: unknown;
                valueType?: string;
                formattedValue?: string;
                executionContext?: {
                  executionId?: string;
                  flowState?: string;
                  hasConnections?: boolean;
                  inputCount?: number;
                };
              };
              if (logData.type === "result_output") {
                const newEntry: DebugResult = {
                  value: logData.value,
                  type: logData.valueType ?? "unknown",
                  timestamp: log.timestamp,
                  executionId: logData.executionContext?.executionId,
                  flowState: logData.executionContext?.flowState,
                  hasConnections: logData.executionContext?.hasConnections,
                  inputCount: logData.executionContext?.inputCount,
                };

                // Accumulate results for this node
                const existingResults = newResults.get(log.nodeId) ?? [];

                // Check if this exact entry already exists (avoid duplicates)
                const isDuplicate = existingResults.some(
                  (existing) =>
                    existing.timestamp === newEntry.timestamp &&
                    existing.executionId === newEntry.executionId &&
                    JSON.stringify(existing.value) ===
                      JSON.stringify(newEntry.value),
                );

                if (!isDuplicate) {
                  const updatedResults = [...existingResults, newEntry].sort(
                    (a, b) => a.timestamp - b.timestamp,
                  );
                  newResults.set(log.nodeId, updatedResults);
                }
              }
            }
          });

          return newResults;
        });

        toast.success(
          `Debug execution completed - ${data.debugLogs.length} output(s) captured`,
        );
      } else {
        toast.info("Debug completed", "No output from result nodes");
      }
    },
    onError: (error) => {
      logger.errorWithStack("Debug execution failed", error);
      const errorMessage =
        error instanceof Error ? error.message : "Debug execution failed";
      toast.error("Debug failed", errorMessage);
    },
  });

  const runToNode = useCallback(
    async (targetNodeId: string) => {
      try {
        const backendNodes = nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        }));

        const backendEdges = edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
        }));

        await debugToNode.mutateAsync({
          nodes: backendNodes,
          edges: backendEdges,
          targetNodeId,
        });
      } catch (error) {
        // Error is already handled in onError callback
        throw error;
      }
    },
    [nodes, edges, debugToNode],
  );

  const getDebugResult = useCallback(
    (nodeId: string): DebugResult | null => {
      const results = debugResults.get(nodeId);
      return results && results.length > 0
        ? (results[results.length - 1] ?? null)
        : null; // Return latest result for backward compatibility
    },
    [debugResults],
  );

  const getAllDebugResults = useCallback(
    (nodeId: string) => {
      return debugResults.get(nodeId) ?? [];
    },
    [debugResults],
  );

  const clearDebugResults = useCallback((nodeId: string) => {
    setDebugResults((prevResults) => {
      const newResults = new Map(prevResults);
      newResults.delete(nodeId);
      return newResults;
    });
  }, []);

  return {
    runToNode,
    getDebugResult,
    getAllDebugResults,
    clearDebugResults,
    isDebugging: debugToNode.isPending,
  };
}
