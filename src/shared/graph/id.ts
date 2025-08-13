// src/shared/graph/id.ts

export type CanonicalId = string;

export interface MinimalNode {
  id: string;
  data?: { identifier?: { id?: string } };
}

export interface MinimalEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  // Allow passthrough of any other edge fields without typing them here
  [key: string]: unknown;
}

// Build a map that translates both React Flow IDs and identifier IDs to canonical identifier IDs
export function buildIdMap(nodes: MinimalNode[]): Map<string, CanonicalId> {
  const map = new Map<string, CanonicalId>();
  for (const node of nodes) {
    const reactFlowId = node.id;
    const identifierId = node?.data?.identifier?.id ?? reactFlowId;
    map.set(reactFlowId, identifierId);
    map.set(identifierId, identifierId);
  }
  return map;
}

export function toCanonicalId(id: string, idMap: Map<string, CanonicalId>): CanonicalId {
  return idMap.get(id) ?? id;
}

export function canonicalizeEdges<T extends MinimalEdge>(
  nodes: MinimalNode[],
  edges: T[]
): T[] {
  const idMap = buildIdMap(nodes);
  return edges.map((edge) => ({
    ...edge,
    source: toCanonicalId(edge.source, idMap),
    target: toCanonicalId(edge.target, idMap),
  }));
}