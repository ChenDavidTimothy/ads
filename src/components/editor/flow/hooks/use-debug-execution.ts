import { useCallback, useState } from 'react';
import { api } from '@/trpc/react';
import { useNotifications } from '@/hooks/use-notifications';
import type { NodeData } from '@/shared/types';

// Minimal local types to avoid dependency on reactflow types at build time
type RFEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };
type RFNode<T> = { id: string; type?: string; position: { x: number; y: number }; data: T };

export function useDebugExecution(nodes: RFNode<NodeData>[], edges: RFEdge[]) {
  const [debugResults, setDebugResults] = useState<Map<string, { value: unknown; type: string; timestamp: number }>>(new Map());
  const { toast } = useNotifications();

  const debugToNode = api.animation.debugToNode.useMutation({
    onSuccess: (data) => {
      // Extract debug logs and update results
      if (data.debugLogs && data.debugLogs.length > 0) {
        const newResults = new Map(debugResults);
        
        data.debugLogs.forEach((log) => {
          if (log.data && typeof log.data === 'object' && log.data !== null) {
            const logData = log.data as { type?: string; value?: unknown; valueType?: string; formattedValue?: string };
            if (logData.type === 'print_output') {
              newResults.set(log.nodeId, {
                value: logData.value,
                type: logData.valueType || 'unknown',
                timestamp: log.timestamp
              });
            }
          }
        });
        
        setDebugResults(newResults);
        toast.success('Debug execution completed');
      } else {
        toast.info('Debug completed', 'No output from print nodes');
      }
    },
    onError: (error) => {
      console.error('[DEBUG] Execution failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Debug execution failed';
      toast.error('Debug failed', errorMessage);
    },
  });

  const runToNode = useCallback(async (targetNodeId: string) => {
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
  }, [nodes, edges, debugToNode]);

  const getDebugResult = useCallback((nodeId: string) => {
    return debugResults.get(nodeId) || null;
  }, [debugResults]);

  return {
    runToNode,
    getDebugResult,
    isDebugging: debugToNode.isPending,
  };
}
