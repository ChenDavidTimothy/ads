"use client";

import { useCallback, useMemo, useRef } from 'react';
import { useWorkspace } from './workspace-context';
import { TimelineEditorCore } from './timeline-editor-core';
import type { TimelineEditorData } from '@/types/workspace-state';

export function TimelineEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateTimeline, updateUI } = useWorkspace();
  const data = state.editors.timeline[nodeId];
  const pendingRef = useRef<TimelineEditorData | null>(null);
  const rafRef = useRef<number | null>(null);

  if (!data) {
    return <div className="h-full w-full flex items-center justify-center text-gray-300">Timeline data not found</div>;
  }

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const pending = pendingRef.current;
      if (pending) {
        updateTimeline(nodeId, pending);
        pendingRef.current = null;
      }
      rafRef.current = null;
    });
  }, [nodeId, updateTimeline]);

  const handleChange = useCallback((updates: Partial<TimelineEditorData>) => {
    const merged: TimelineEditorData = {
      duration: updates.duration ?? data.duration,
      tracks: updates.tracks ?? data.tracks,
    };
    pendingRef.current = merged;
    scheduleUpdate();
  }, [data.duration, data.tracks, scheduleUpdate]);

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 px-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/60">
        <div className="text-white font-medium">Timeline</div>
        <button className="text-sm text-gray-300 hover:text-white" onClick={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}>Back to Flow</button>
      </div>
      <div className="flex-1">
        <TimelineEditorCore
          animationNodeId={nodeId}
          duration={data.duration}
          tracks={data.tracks}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}