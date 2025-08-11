// src/components/workspace/flow/hooks/useTimelineEditor.ts
import { useCallback, useState } from 'react';
import type { Node } from 'reactflow';
import type { AnimationTrack, NodeData } from '@/shared/types';
import type { TimelineModalState } from '../types';

export function useTimelineEditor(nodes: Node<NodeData>[]) {
  // Legacy shim retained to avoid breaking imports; the modal is deprecated in favor of a dedicated page.
  const [timelineModalState, setTimelineModalState] = useState<TimelineModalState>({ isOpen: false, nodeId: null });
  const [timelineNode, setTimelineNode] = useState<Node<NodeData> | null>(null);
  const handleOpenTimelineEditor = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId) ?? null;
    setTimelineNode(node);
    setTimelineModalState({ isOpen: true, nodeId });
  }, [nodes]);
  const handleCloseTimelineEditor = useCallback(() => {
    setTimelineNode(null);
    setTimelineModalState({ isOpen: false, nodeId: null });
  }, []);
  const getTimelineNodeData = useCallback(() => ({ duration: 3, tracks: [] as AnimationTrack[] }), []);

  return {
    timelineModalState,
    setTimelineModalState,
    handleOpenTimelineEditor,
    handleCloseTimelineEditor,
    timelineNode,
    getTimelineNodeData,
  } as const;
}


