// src/components/editor/flow/hooks/useTimelineEditor.ts
import { useCallback, useMemo, useState } from 'react';
import type { Node } from 'reactflow';
import type { AnimationTrack, NodeData } from '@/shared/types';
import type { TimelineModalState } from '../types';

export function useTimelineEditor(nodes: Node<NodeData>[]) {
  const [timelineModalState, setTimelineModalState] = useState<TimelineModalState>({ isOpen: false, nodeId: null });

  const handleOpenTimelineEditor = useCallback((nodeId: string) => {
    setTimelineModalState({ isOpen: true, nodeId });
  }, []);

  const handleCloseTimelineEditor = useCallback(() => {
    setTimelineModalState({ isOpen: false, nodeId: null });
  }, []);

  const timelineNode = useMemo(
    () => (timelineModalState.nodeId ? nodes.find((n) => n.data.identifier.id === timelineModalState.nodeId) ?? null : null),
    [nodes, timelineModalState.nodeId]
  );

  const getTimelineNodeData = useCallback(() => {
    if (!timelineNode) return { duration: 3, tracks: [] as AnimationTrack[] };
    const data = timelineNode.data as unknown as Partial<{ duration: number; tracks: AnimationTrack[] }>;
    return {
      duration: (typeof data.duration === 'number' ? data.duration : 3),
      tracks: Array.isArray(data.tracks) ? data.tracks : ([] as AnimationTrack[]),
    };
  }, [timelineNode]);

  return {
    timelineModalState,
    setTimelineModalState,
    handleOpenTimelineEditor,
    handleCloseTimelineEditor,
    timelineNode,
    getTimelineNodeData,
  } as const;
}


