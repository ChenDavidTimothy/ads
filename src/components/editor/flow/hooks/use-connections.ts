// src/components/editor/flow/hooks/use-connections.ts
import { useCallback } from 'react';
import { addEdge, type Connection, type Edge, type Node } from 'reactflow';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { arePortsCompatible } from '@/shared/types/ports';
import type { NodeData } from '@/shared/types';
import type { FlowTracker } from '@/lib/flow/flow-tracking';
import { useNotifications } from '@/hooks/use-notifications';

export function useConnections(
  nodes: Node<NodeData>[],
  edges: Edge[],
  setEdges: (updater: Edge[] | ((eds: Edge[]) => Edge[])) => void,
  flowTracker: FlowTracker,
) {
  const { toast } = useNotifications();

  const wouldConnectionCreateDuplicateObjectIds = useCallback((
    sourceNodeId: string,
    targetNodeId: string,
    edgesWithNewConnection: Edge[],
    allNodes: Node<NodeData>[]
  ): string[] => {
    const upstreamObjects = flowTracker.getUpstreamGeometryObjects(targetNodeId, allNodes, edgesWithNewConnection);
    const objectIds = upstreamObjects.map((obj) => obj.data.identifier.id);
    return objectIds.filter((id, index) => objectIds.indexOf(id) !== index);
  }, [flowTracker]);

  const onConnect = useCallback((params: Connection) => {
    // CRITICAL FIX: params.source/target are React Flow node IDs, which equal identifier IDs
    const sourceNode = nodes.find((n) => n.id === params.source);
    const targetNode = nodes.find((n) => n.id === params.target);
    
    if (!sourceNode || !targetNode) {
      toast.error('Connection failed', 'Source or target node not found');
      return;
    }

    const sourceDefinition = getNodeDefinition(sourceNode.type!);
    const targetDefinition = getNodeDefinition(targetNode.type!);

    if (!sourceDefinition || !targetDefinition) {
      toast.error('Connection failed', 'Unknown node type');
      return;
    }

    // CRITICAL FIX: Validate ports before checking duplicates
    const sourcePort = sourceDefinition.ports.outputs.find((p) => p.id === params.sourceHandle);
    const targetPort = targetDefinition.ports.inputs.find((p) => p.id === params.targetHandle);
    if (!sourcePort || !targetPort) {
      toast.error('Connection failed', 'Invalid port');
      return;
    }

    if (!arePortsCompatible(sourcePort.type, targetPort.type)) {
      toast.error('Connection failed', `${sourcePort.type} output incompatible with ${targetPort.type} input`);
      return;
    }

    // CRITICAL FIX: Block ALL nodes except geometry and merge from receiving duplicate object IDs
    if (targetDefinition.execution.category !== 'geometry' && targetNode.type !== 'merge') {
      const simulatedEdges = [
        ...edges,
        {
          id: 'temp-validation-edge',
          source: sourceNode.id, // Use React Flow IDs consistently
          target: targetNode.id,
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle,
        } as Edge,
      ];

      const wouldCreateDuplicates = wouldConnectionCreateDuplicateObjectIds(
        sourceNode.id,
        targetNode.id,
        simulatedEdges,
        nodes
      );

      if (wouldCreateDuplicates.length > 0) {
        toast.error(
          'Connection blocked - Duplicate object IDs',
          `This connection would cause duplicate object IDs (${wouldCreateDuplicates.join(', ')}) to reach ${targetNode.data.identifier.displayName}. Only Merge nodes can receive identical object IDs. Use a Merge node to resolve conflicts.`
        );
        return; // BLOCK THE CONNECTION
      }
    }

    const newEdges = addEdge(
      {
        ...params,
        // Keep React Flow IDs for edge source/target for consistency
        source: sourceNode.id,
        target: targetNode.id,
      },
      edges
    );

    const newEdge = newEdges.find((edge) => !edges.some((existingEdge) => existingEdge.id === edge.id));
    if (!newEdge) {
      toast.error('Connection failed', 'Failed to create edge');
      return;
    }

    flowTracker.trackConnection(
      newEdge.id,
      sourceNode.data.identifier.id, // Use identifier IDs for flow tracking
      targetNode.data.identifier.id,
      params.sourceHandle!,
      params.targetHandle!,
      nodes
    );

    setEdges(newEdges);
  }, [nodes, edges, setEdges, flowTracker, toast, wouldConnectionCreateDuplicateObjectIds]);

  return { onConnect } as const;
}