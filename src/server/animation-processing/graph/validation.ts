// src/server/animation-processing/graph/validation.ts
import { getNodesByCategory } from "@/shared/registry/registry-utils";
import { DuplicateObjectIdsError, MissingInsertConnectionError, SceneRequiredError, TooManyScenesError } from "@/shared/errors/domain";
import type { NodeData } from "@/shared/types";
import type { ReactFlowEdge, ReactFlowNode } from "../types/graph";

export function validateScene(nodes: ReactFlowNode<NodeData>[]): void {
  const sceneNodes = nodes.filter((node) => node.type === 'scene');
  if (sceneNodes.length === 0) throw new SceneRequiredError();
  if (sceneNodes.length > 1) throw new TooManyScenesError();
}

export function validateConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Connection validation logic can be added here if needed in the future
  // Currently no restrictions on object branching - Merge nodes handle conflicts
}

export function validateProperFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);
  const geometryNodes = nodes.filter((n) => geometryNodeTypes.includes(n.type!));

  for (const geoNode of geometryNodes) {
    const isConnectedToScene = isNodeConnectedToScene(geoNode.data.identifier.id, edges, nodes);
    if (isConnectedToScene) {
      const canReachInsert = canReachNodeType(geoNode.data.identifier.id, 'insert', edges, nodes);
      if (!canReachInsert) {
        throw new MissingInsertConnectionError(geoNode.data.identifier.displayName, geoNode.data.identifier.id);
      }
    }
  }
}

export function validateNoDuplicateObjectIds(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);

  for (const targetNode of nodes) {
    if (geometryNodeTypes.includes(targetNode.type!) || targetNode.type === 'merge') {
      continue;
    }

    const incomingObjectIds = getIncomingObjectIds(targetNode.data.identifier.id, edges, nodes);
    const duplicates = incomingObjectIds.filter((id, index) => incomingObjectIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      throw new DuplicateObjectIdsError(targetNode.data.identifier.displayName, targetNode.data.identifier.id, duplicates);
    }
  }
}

function getIncomingObjectIds(targetNodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): string[] {
  const geometryNodes: ReactFlowNode<NodeData>[] = [];
  const visited = new Set<string>();
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);

  const traceUpstream = (currentNodeId: string): void => {
    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);
    const currentNode = nodes.find((n) => n.data.identifier.id === currentNodeId);
    if (!currentNode) return;
    if (geometryNodeTypes.includes(currentNode.type!)) {
      geometryNodes.push(currentNode);
      return;
    }
    const incomingEdges = edges.filter((edge) => edge.target === currentNodeId);
    for (const edge of incomingEdges) traceUpstream(edge.source);
  };

  traceUpstream(targetNodeId);
  return geometryNodes.map((node) => node.data.identifier.id);
}

function canReachNodeType(
  startNodeId: string,
  targetNodeType: string,
  edges: ReactFlowEdge[],
  nodes: ReactFlowNode<NodeData>[]
): boolean {
  const visited = new Set<string>();
  const traverse = (currentNodeId: string): boolean => {
    if (visited.has(currentNodeId)) return false;
    visited.add(currentNodeId);
    const currentNode = nodes.find((n) => n.data.identifier.id === currentNodeId);
    if (currentNode?.type === targetNodeType) return true;
    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
    return outgoingEdges.some((edge) => traverse(edge.target));
  };
  return traverse(startNodeId);
}

function isNodeConnectedToScene(nodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): boolean {
  const visited = new Set<string>();
  const traverse = (currentNodeId: string): boolean => {
    if (visited.has(currentNodeId)) return false;
    visited.add(currentNodeId);
    const currentNode = nodes.find((n) => n.data.identifier.id === currentNodeId);
    if (currentNode?.type === 'scene') return true;
    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
    return outgoingEdges.some((edge) => traverse(edge.target));
  };
  return traverse(nodeId);
}


