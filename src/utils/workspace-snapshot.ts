import type { Node, Edge } from 'reactflow';
import type { NodeData } from '@/shared/types/nodes';
import type { WorkspaceState } from '@/types/workspace-state';
import { mergeEditorsIntoFlow } from '@/utils/workspace-state';

// Type for sanitized node data structure
interface SanitizedNodeData {
  identifier?: {
    id?: string;
    createdAt?: number;
  };
  [key: string]: unknown;
}

export function createStableFlowSnapshot(flow: { nodes: Node<NodeData>[]; edges: Edge[] }): string {
  try {
    const normNodes = [...flow.nodes]
      .map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: sanitizeNodeData(n.data),
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const normEdges = [...flow.edges]
      .map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return JSON.stringify({ n: normNodes, e: normEdges });
  } catch {
    return Math.random().toString();
  }
}

function sanitizeNodeData(data: NodeData): SanitizedNodeData {
  try {
    // Deep clone the data safely with proper typing
    const cloned = JSON.parse(JSON.stringify(data)) as SanitizedNodeData;
    
    // Check if the cloned data has an identifier and handle it safely
    if (cloned.identifier && typeof cloned.identifier === 'object') {
      const identifier = cloned.identifier as { id?: string; createdAt?: unknown };
      // Drop volatile timestamp for stable comparisons
      if (typeof identifier.createdAt !== 'undefined') {
        identifier.createdAt = 0;
      }
    }
    
    return cloned;
  } catch {
    // Fallback: return a safe version of the data
    return data as unknown as SanitizedNodeData;
  }
}

export function createPersistablePayload(state: WorkspaceState): { nodes: Node<NodeData>[]; edges: Edge[] } {
  return mergeEditorsIntoFlow(state);
}