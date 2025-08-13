import type { Node, Edge } from 'reactflow';
import type { NodeData } from '@/shared/types/nodes';
import type { WorkspaceState } from '@/types/workspace-state';
import { mergeEditorsIntoFlow } from '@/utils/workspace-state';

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

function sanitizeNodeData(data: NodeData): unknown {
  try {
    const cloned: any = JSON.parse(JSON.stringify(data));
    if (cloned?.identifier) {
      // Drop volatile timestamp for stable comparisons
      if (typeof cloned.identifier.createdAt !== 'undefined') cloned.identifier.createdAt = 0;
    }
    return cloned;
  } catch {
    return data as unknown as object;
  }
}

export function createPersistablePayload(state: WorkspaceState): { nodes: Node<NodeData>[]; edges: Edge[] } {
  return mergeEditorsIntoFlow(state);
}