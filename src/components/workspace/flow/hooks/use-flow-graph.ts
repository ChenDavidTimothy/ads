// src/components/workspace/flow/hooks/useFlowGraph.ts - Fixed React render errors
import { useCallback, useMemo, useState } from "react";
import {
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeChange,
} from "reactflow";
import { getDefaultNodeData } from "@/lib/defaults/nodes";
import {
  getNodeDefinition,
  getNodeDefinitionWithDynamicPorts,
} from "@/shared/registry/registry-utils";
import type { NodeData, NodeType } from "@/shared/types";
import { FlowTracker } from "@/lib/flow/flow-tracking";
import { useNotifications } from "@/hooks/use-notifications";

export function useFlowGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowTracker] = useState(() => new FlowTracker());
  const { toast } = useNotifications();

  // Optimized node change handler to reduce re-renders during drag
  const optimizedOnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Batch position-only changes to improve drag performance
      const positionChanges = changes.filter(
        (change) => change.type === "position" && change.dragging === true,
      );

      const otherChanges = changes.filter(
        (change) => change.type !== "position" || change.dragging !== true,
      );

      // Handle position changes immediately for smooth dragging
      if (positionChanges.length > 0) {
        onNodesChange(positionChanges);
      }

      // Handle other changes with a small delay to batch them
      if (otherChanges.length > 0) {
        setTimeout(() => onNodesChange(otherChanges), 8); // 120fps for responsiveness
      }
    },
    [onNodesChange],
  );

  // Unified edge validation function for nodes with dynamic ports
  const cleanupInvalidDynamicEdges = useCallback(
    (currentNodes: Node<NodeData>[], currentEdges: Edge[]) => {
      const edgesToRemove: Edge[] = [];

      currentNodes.forEach((node) => {
        if (node.type === "merge") {
          // Only handle merge nodes here - boolean nodes handle their own cleanup
          const dynamicDefinition = getNodeDefinitionWithDynamicPorts(
            node.type,
            node.data as unknown as Record<string, unknown>,
          );
          const validPortIds = new Set(
            dynamicDefinition?.ports.inputs.map((p) => p.id) ?? [],
          );

          currentEdges.forEach((edge) => {
            if (
              edge.target === node.id &&
              edge.targetHandle &&
              !validPortIds.has(edge.targetHandle)
            ) {
              edgesToRemove.push(edge);
            }
          });
        }
      });

      return currentEdges.filter((edge) => !edgesToRemove.includes(edge));
    },
    [],
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.data.identifier.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  const updateNodeData = useCallback(
    (nodeId: string, newData: Partial<NodeData>): Node<NodeData>[] => {
      // Handle edge cleanup synchronously for merge nodes to prevent race conditions
      if ("inputPortCount" in newData) {
        const updatedNode = nodes.find((n) => n.data.identifier.id === nodeId);
        if (updatedNode?.type === "merge") {
          const updatedNodeData = { ...updatedNode.data, ...newData };

          // Get the new dynamic port definition
          const dynamicDefinition = getNodeDefinitionWithDynamicPorts(
            "merge",
            updatedNodeData,
          );
          const validPortIds = new Set(
            dynamicDefinition?.ports.inputs.map((p) => p.id) ?? [],
          );

          // Compute next nodes array
          const nextNodes = nodes.map((node) =>
            node.data.identifier.id === nodeId
              ? { ...node, data: { ...node.data, ...newData } }
              : node,
          );
          setNodes(nextNodes as unknown as Node<NodeData>[]);

          // Clean up edges synchronously without toast notification
          setEdges((eds) => {
            const invalidEdges = eds.filter(
              (edge) =>
                edge.target === updatedNode.id &&
                edge.targetHandle &&
                !validPortIds.has(edge.targetHandle),
            );

            if (invalidEdges.length > 0) {
              invalidEdges.forEach((edge) => {
                flowTracker.removeConnection(edge.id);
              });
              console.log(
                `[CLEANUP] Removed ${invalidEdges.length} invalid connection(s) during port reconfiguration`,
              );
            }

            return eds.filter(
              (edge) =>
                !(
                  edge.target === updatedNode.id &&
                  edge.targetHandle &&
                  !validPortIds.has(edge.targetHandle)
                ),
            );
          });

          return nextNodes as unknown as Node<NodeData>[];
        }
      }

      // Handle edge cleanup for boolean operation nodes - cut ties only when involving NOT
      if ("operator" in newData) {
        const updatedNode = nodes.find((n) => n.data.identifier.id === nodeId);
        if (updatedNode?.type === "boolean_op") {
          const oldOperator = (updatedNode.data as { operator?: string })
            .operator;
          const newOperator = newData.operator as string;

          // Check if this change involves NOT operation (layout change)
          const involvesNot = oldOperator === "not" || newOperator === "not";

          // Compute next nodes array
          const nextNodes = nodes.map((node) =>
            node.data.identifier.id === nodeId
              ? { ...node, data: { ...node.data, ...newData } }
              : node,
          );
          setNodes(nextNodes as unknown as Node<NodeData>[]);

          if (involvesNot) {
            // Cut ALL connections when switching to/from NOT - clean slate
            setEdges((eds) => {
              const removedEdges = eds.filter(
                (edge) => edge.target === updatedNode.id,
              );

              if (removedEdges.length > 0) {
                removedEdges.forEach((edge) => {
                  flowTracker.removeConnection(edge.id);
                });
                console.log(
                  `[SIMPLE-CLEANUP] Cut ${removedEdges.length} connection(s) due to NOT operation change - user can reconnect`,
                );
              }

              return eds.filter((edge) => edge.target !== updatedNode.id);
            });
          }

          return nextNodes as unknown as Node<NodeData>[];
        }

        // Handle edge cleanup for math operation nodes - cut ties when changing port count
        if (updatedNode?.type === "math_op") {
          const oldOperator = (updatedNode.data as { operator?: string })
            .operator;
          const newOperator = newData.operator as string;

          // Define unary operations (1 input) vs binary operations (2 inputs)
          const unaryOps = ["sqrt", "abs"];
          const oldIsUnary = oldOperator
            ? unaryOps.includes(oldOperator)
            : false;
          const newIsUnary = unaryOps.includes(newOperator);

          // Check if this change involves port count change
          const involvesPortChange = oldIsUnary !== newIsUnary;

          // Compute next nodes array
          const nextNodes = nodes.map((node) =>
            node.data.identifier.id === nodeId
              ? { ...node, data: { ...node.data, ...newData } }
              : node,
          );
          setNodes(nextNodes as unknown as Node<NodeData>[]);

          if (involvesPortChange) {
            // Cut ALL connections when switching between unary/binary operations
            setEdges((eds) => {
              const removedEdges = eds.filter(
                (edge) => edge.target === updatedNode.id,
              );

              if (removedEdges.length > 0) {
                removedEdges.forEach((edge) => {
                  flowTracker.removeConnection(edge.id);
                });
                console.log(
                  `[SIMPLE-CLEANUP] Cut ${removedEdges.length} connection(s) due to math operation port change - user can reconnect`,
                );
              }

              return eds.filter((edge) => edge.target !== updatedNode.id);
            });
          }

          return nextNodes as unknown as Node<NodeData>[];
        }
      }

      // Regular node data update for non-merge nodes or non-port-count changes
      const nextNodes = nodes.map((node) =>
        node.data.identifier.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node,
      );
      setNodes(nextNodes as unknown as Node<NodeData>[]);
      return nextNodes as unknown as Node<NodeData>[];
    },
    [setNodes, setEdges, nodes, flowTracker],
  );

  const validateDisplayName = useCallback(
    (newName: string, nodeId: string): string | null => {
      return flowTracker.validateDisplayName(newName, nodeId, nodes);
    },
    [flowTracker, nodes],
  );

  const updateDisplayName = useCallback(
    (nodeId: string, newDisplayName: string): Node<NodeData>[] | null => {
      const error = validateDisplayName(newDisplayName, nodeId);
      if (error) {
        toast.error("Name validation failed", error);
        return null;
      }
      const nextNodes = nodes.map((node) =>
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
          : node,
      );
      setNodes(nextNodes as unknown as Node<NodeData>[]);
      return nextNodes as unknown as Node<NodeData>[];
    },
    [validateDisplayName, setNodes, toast, nodes],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<NodeData>) => {
      setSelectedNodeId(node.data.identifier.id);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onNodesDelete = useCallback(
    (deletedNodes: Node<NodeData>[]) => {
      // Prevent deletion if it would leave the workspace empty
      const remainingNodes = nodes.length - deletedNodes.length;
      if (remainingNodes === 0) {
        toast.error(
          "Cannot delete the last node",
          "At least one node must remain in the workspace to maintain scene structure."
        );
        return;
      }

      // Remove from flow tracker
      deletedNodes.forEach((node: Node<NodeData>) => {
        flowTracker.removeNode(node.data.identifier.id);
      });

      // Remove from React state
      setNodes((currentNodes) =>
        currentNodes.filter(
          (node) =>
            !deletedNodes.some((deletedNode) => deletedNode.id === node.id),
        ),
      );
    },
    [flowTracker, setNodes, nodes.length, toast],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      // Remove from flow tracker
      deletedEdges.forEach((edge: Edge) => {
        flowTracker.removeConnection(edge.id);
      });

      // Remove from React state
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) =>
            !deletedEdges.some((deletedEdge) => deletedEdge.id === edge.id),
        ),
      );
    },
    [flowTracker, setEdges],
  );

  const handleAddNode = useCallback(
    (nodeType: string, position: { x: number; y: number }) => {
      if (nodeType === "scene") {
        const existingSceneNodes = nodes.filter(
          (node) => node.type === "scene",
        );
        const maxScenes = Number(
          process.env.NEXT_PUBLIC_MAX_SCENES_PER_EXECUTION ?? "8",
        );
        if (existingSceneNodes.length >= maxScenes) {
          toast.warning(
            "Scene limit reached",
            `Maximum ${maxScenes} scene nodes allowed per workspace`,
          );
          return;
        }
      }

      const nodeDefinition = getNodeDefinition(nodeType as NodeType);
      if (!nodeDefinition) {
        toast.error("Node creation failed", `Unknown node type: ${nodeType}`);
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
    },
    [nodes, setNodes, flowTracker, toast],
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: optimizedOnNodesChange,
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
    cleanupInvalidDynamicEdges,
  } as const;
}
