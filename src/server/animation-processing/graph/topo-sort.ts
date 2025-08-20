// src/server/animation-processing/graph/topo-sort.ts
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import type { NodeData } from "@/shared/types";
import { CircularDependencyError } from "@/shared/errors/domain";

export function getTopologicalOrder(
  nodes: ReactFlowNode<NodeData>[],
  edges: ReactFlowEdge[]
): ReactFlowNode<NodeData>[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.data.identifier.id, 0);
    adjList.set(node.data.identifier.id, []);
  }

  for (const edge of edges) {
    adjList.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: ReactFlowNode<NodeData>[] = [];
  const result: ReactFlowNode<NodeData>[] = [];

  for (const node of nodes) {
    if (inDegree.get(node.data.identifier.id) === 0) {
      queue.push(node);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const neighborId of adjList.get(current.data.identifier.id) ?? []) {
      const newInDegree = (inDegree.get(neighborId) ?? 1) - 1;
      inDegree.set(neighborId, newInDegree);

      if (newInDegree === 0) {
        const neighborNode = nodes.find((n) => n.data.identifier.id === neighborId);
        if (neighborNode) {
          queue.push(neighborNode);
        }
      }
    }
  }

  if (result.length !== nodes.length) {
    throw new CircularDependencyError();
  }

  return result;
}


