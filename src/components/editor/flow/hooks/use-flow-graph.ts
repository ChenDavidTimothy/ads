// src/components/editor/flow/hooks/useFlowGraph.ts
import { useCallback, useMemo, useState } from 'react';
import { useEdgesState, useNodesState, type Edge, type Node } from 'reactflow';
import { getDefaultNodeData } from '@/lib/defaults/nodes';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { NodeData, NodeType } from '@/shared/types';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { useNotifications } from '@/hooks/use-notifications';

export function useFlowGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowTracker] = useState(() => new FlowTracker());
  const { toast } = useNotifications();

  const selectedNode = useMemo(
    () => nodes.find((node) => node.data.identifier.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const updateNodeData = useCallback((nodeId: string, newData: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.data.identifier.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
  }, [setNodes]);

  const validateDisplayName = useCallback((newName: string, nodeId: string): string | null => {
    return flowTracker.validateDisplayName(newName, nodeId, nodes);
  }, [flowTracker, nodes]);

  const updateDisplayName = useCallback((nodeId: string, newDisplayName: string): boolean => {
    const error = validateDisplayName(newDisplayName, nodeId);
    if (error) {
      toast.error('Name validation failed', error);
      return false;
    }
    setNodes((nds) =>
      nds.map((node) =>
        node.data.identifier.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                identifier: {
                  ...node.data.identifier,
                  displayName: newDisplayName,
                },
              },
            }
          : node
      )
    );
    return true;
  }, [validateDisplayName, setNodes, toast]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<NodeData>) => {
    setSelectedNodeId(node.data.identifier.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onNodesDelete = useCallback((deletedNodes: Node<NodeData>[]) => {
    deletedNodes.forEach((node: Node<NodeData>) => {
      flowTracker.removeNode(node.data.identifier.id);
    });
  }, [flowTracker]);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach((edge: Edge) => {
      flowTracker.removeConnection(edge.id);
    });
  }, [flowTracker]);

  const handleAddNode = useCallback((nodeType: string, position: { x: number; y: number }) => {
    if (nodeType === 'scene') {
      const existingSceneNodes = nodes.filter((node) => node.type === 'scene');
      if (existingSceneNodes.length > 0) {
        toast.warning('Scene limit reached', 'Only one scene node allowed per workspace');
        return;
      }
    }

    const nodeDefinition = getNodeDefinition(nodeType as NodeType);
    if (!nodeDefinition) {
      toast.error('Node creation failed', `Unknown node type: ${nodeType}`);
      return;
    }

    const nodeData = getDefaultNodeData(nodeType as NodeType, nodes);
    const newNode: Node<NodeData> = {
      id: nodeData.identifier.id,
      type: nodeType,
      position,
      data: nodeData,
    };

    flowTracker.trackNodeCreation(nodeData.identifier.id);
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes, flowTracker, toast]);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    selectedNodeId,
    selectedNode,
    updateNodeData,
    updateDisplayName,
    validateDisplayName,
    onNodeClick,
    onPaneClick,
    onNodesDelete,
    onEdgesDelete,
    handleAddNode,
    flowTracker,
  } as const;
}


