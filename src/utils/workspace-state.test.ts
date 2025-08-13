import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import type { NodeData, AnimationTrack } from '@/shared/types/nodes';
import { extractWorkspaceState } from './workspace-state';

function makeAnimationNode(id: string, tracks?: Partial<AnimationTrack>[]): Node<NodeData> {
  const data: any = {
    identifier: { id, type: 'animation', createdAt: 0, sequence: 1, displayName: id },
    lineage: { parentNodes: [], childNodes: [], flowPath: [] },
    duration: 3,
    tracks: (tracks ?? []).map((t) => ({
      startTime: 0,
      duration: 1,
      easing: 'easeInOut',
      type: 'move',
      properties: { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
      ...t,
    })),
  };
  return { id, type: 'animation', position: { x: 0, y: 0 }, data } as any;
}

describe('extractWorkspaceState', () => {
  it('ensures timeline tracks have identifiers', () => {
    const node = makeAnimationNode('anim1', [{ } as any]);
    const state = extractWorkspaceState({ id: 'ws', name: 'n', version: 1, updated_at: new Date().toISOString(), flow_data: { nodes: [node], edges: [] } });
    const tl = state.editors.timeline['anim1'];
    expect(tl).toBeDefined();
    const t = tl!.tracks[0]!;
    expect(t).toBeDefined();
    expect((t as any).identifier).toBeDefined();
  });
});