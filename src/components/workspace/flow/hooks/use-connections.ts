// src/components/workspace/flow/hooks/use-connections.ts - Simplified without validation
import { useCallback } from 'react';
import { addEdge, type Connection, type Edge, type Node } from 'reactflow';
import type { NodeData } from '@/shared/types';
import type { FlowTracker } from '@/lib/flow/flow-tracking';

export function useConnections(
  nodes: Node<NodeData>[],
  edges: Edge[],
  setEdges: (updater: Edge[] | ((eds: Edge[]) => Edge[])) => void,
  flowTracker: FlowTracker,
  updateContextEdges?: (newEdges: Edge[]) => void,
) {
  // Toast notifications removed for connections as they're frequent user actions

  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find((n) => n.id === params.source);
    const targetNode = nodes.find((n) => n.id === params.target);
    
    if (!sourceNode || !targetNode) {
      console.warn('[CONNECTION] Source or target node not found:', params);
      return;
    }

    // No validation - allow all connections
    // Validation will happen at generation time in the backend
    
    const newEdges = addEdge(
      {
        ...params,
        source: sourceNode.id,
        target: targetNode.id,
      },
      edges
    );

    const newEdge = newEdges.find((edge) => !edges.some((existingEdge) => existingEdge.id === edge.id));
    if (!newEdge) {
      console.warn('[CONNECTION] Failed to create edge');
      return;
    }

    // Track connection for flow analysis (non-validation purposes)
    flowTracker.trackConnection(
      newEdge.id,
      sourceNode.data.identifier.id,
      targetNode.data.identifier.id,
      params.sourceHandle!,
      params.targetHandle!,
      nodes
    );

    setEdges(newEdges);
    if (updateContextEdges) updateContextEdges(newEdges);
    
    // No success toast for connections - they're frequent user actions
  }, [nodes, edges, setEdges, flowTracker, updateContextEdges]);

  return { onConnect } as const;
}