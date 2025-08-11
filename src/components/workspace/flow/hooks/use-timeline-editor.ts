// src/components/workspace/flow/hooks/useTimelineEditor.ts
import { useCallback, useMemo, useState } from 'react';
import type { Node } from 'reactflow';
import type { AnimationTrack, NodeData } from '@/shared/types';
import type { TimelineModalState } from '../types';

export function useTimelineEditor(_nodes: Node<NodeData>[]) {
  // Legacy shim retained to avoid breaking imports; the modal is deprecated in favor of a dedicated page.
  const handleOpenTimelineEditor = useCallback((_nodeId: string) => {}, []);
  const handleCloseTimelineEditor = useCallback(() => {}, []);
  const getTimelineNodeData = useCallback(() => ({ duration: 3, tracks: [] as AnimationTrack[] }), []);

  return {
    timelineModalState: { isOpen: false, nodeId: null } as TimelineModalState,
    setTimelineModalState: () => {},
    handleOpenTimelineEditor,
    handleCloseTimelineEditor,
    timelineNode: null,
    getTimelineNodeData,
  } as const;
}


