import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import type { NodeData } from '@/shared/types/nodes';
import { createStableFlowSnapshot } from './workspace-snapshot';
import { extractWorkspaceState, mergeEditorsIntoFlow } from './workspace-state';

function makeNode(id: string, type: string, data: Partial<NodeData> = {}): Node<NodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      identifier: { id, type: type as any, createdAt: 0, sequence: 1, displayName: id },
      lineage: { parentNodes: [], childNodes: [], flowPath: [] },
      ...(data as any),
    } as NodeData,
  } as Node<NodeData>;
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}

describe('createStableFlowSnapshot', () => {
  it('produces identical snapshot for same graph order-insensitive', () => {
    const nodesA = [makeNode('a', 'triangle'), makeNode('b', 'circle')];
    const nodesB = [makeNode('b', 'circle'), makeNode('a', 'triangle')];
    const edgesA = [makeEdge('e1', 'a', 'b')];
    const edgesB = [makeEdge('e1', 'a', 'b')];

    const snapA = createStableFlowSnapshot({ nodes: nodesA, edges: edgesA });
    const snapB = createStableFlowSnapshot({ nodes: nodesB, edges: edgesB });
    expect(snapA).toEqual(snapB);
  });
});

describe('extract/merge timeline data', () => {
  it('extracts timeline from animation nodes and merges back', () => {
    const animationNode = makeNode('anim1', 'animation', { duration: 3, tracks: [] } as any);
    const otherNode = makeNode('x', 'triangle');
    const workspaceRow = {
      id: 'ws1',
      name: 'Test',
      version: 1,
      updated_at: new Date().toISOString(),
      flow_data: { nodes: [animationNode, otherNode], edges: [] },
    };

    const state = extractWorkspaceState(workspaceRow);
    expect(state.editors.timeline['anim1']).toBeDefined();
    expect(state.editors.timeline['anim1']!.duration).toBe(3);

    // mutate timeline and merge back
    state.editors.timeline['anim1']!.duration = 5;
    const merged = mergeEditorsIntoFlow(state);
    const node = (merged.nodes as any[]).find((n) => n.id === 'anim1');
    expect(node.data.duration).toBe(5);
  });
});