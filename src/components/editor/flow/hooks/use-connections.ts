// src/components/editor/flow/hooks/useConnections.ts
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
    _sourceNodeId: string,
    targetNodeId: string,
    edgesWithNewConnection: Edge[],
    allNodes: Node<NodeData>[]
  ): string[] => {
    const upstreamObjects = flowTracker.getUpstreamGeometryObjects(targetNodeId, allNodes, edgesWithNewConnection);
    const objectIds = upstreamObjects.map((obj) => obj.data.identifier.id);
    return objectIds.filter((id, index) => objectIds.indexOf(id) !== index);
  }, [flowTracker]);

  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find((n) => n.data.identifier.id === params.source);
    const targetNode = nodes.find((n) => n.data.identifier.id === params.target);
    if (!sourceNode || !targetNode) return;

    const sourceDefinition = getNodeDefinition(sourceNode.type!);
    const targetDefinition = getNodeDefinition(targetNode.type!);



    if (targetDefinition?.execution.category !== 'geometry' && targetNode.type !== 'merge') {
      const wouldCreateDuplicates = wouldConnectionCreateDuplicateObjectIds(
        sourceNode.data.identifier.id,
        targetNode.data.identifier.id,
        [
          ...edges,
          {
            id: 'temp',
            source: sourceNode.data.identifier.id,
            target: targetNode.data.identifier.id,
            sourceHandle: params.sourceHandle,
            targetHandle: params.targetHandle,
          } as Edge,
        ],
        nodes
      );
      if (wouldCreateDuplicates.length > 0) {
        toast.error(
          'Connection not allowed',
          `This connection would cause duplicate object IDs (${wouldCreateDuplicates.join(', ')}) to reach ${targetNode.data.identifier.displayName}. Each node can only receive each object once.`
        );
        return;
      }
    }

    if (!sourceDefinition || !targetDefinition) {
      toast.error('Connection failed', 'Unknown node type');
      return;
    }

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

    const newEdges = addEdge(
      {
        ...params,
        source: sourceNode.data.identifier.id,
        target: targetNode.data.identifier.id,
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
      sourceNode.data.identifier.id,
      targetNode.data.identifier.id,
      params.sourceHandle!,
      params.targetHandle!,
      nodes
    );

    setEdges(newEdges);
  }, [nodes, edges, setEdges, flowTracker, toast, wouldConnectionCreateDuplicateObjectIds]);

  return { onConnect } as const;
}


