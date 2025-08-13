"use client";

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { useWorkspace } from './workspace-context';
import { TimelineEditorCore } from './timeline-editor-core';
import type { TimelineEditorData } from '@/types/workspace-state';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { NodeData } from '@/shared/types';
import type { PerObjectAssignments, ObjectAssignments, TrackOverride } from '@/shared/properties/assignments';

export function TimelineEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateTimeline, updateUI, updateFlow } = useWorkspace();
  const data = state.editors.timeline[nodeId];
  const pendingRef = useRef<TimelineEditorData | null>(null);
  const rafRef = useRef<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = React.useState<string | null>(null);

  // Find the animation node in the flow and its current assignments
  const animationNode = React.useMemo(() => state.flow.nodes.find(n => (n as any)?.data?.identifier?.id === nodeId) as any, [state.flow.nodes, nodeId]);
  const currentAssignments: PerObjectAssignments = (animationNode?.data?.perObjectAssignments as PerObjectAssignments) ?? {};

  // Compute upstream objects
  const upstreamObjects = React.useMemo(() => {
    const tracker = new FlowTracker();
    return tracker.getUpstreamGeometryObjects(nodeId, state.flow.nodes as unknown as any[], state.flow.edges as any[]);
  }, [nodeId, state.flow.nodes, state.flow.edges]);

  const updateAssignmentsForTrack = React.useCallback((objectId: string, trackId: string, updates: Partial<TrackOverride>) => {
    const next: PerObjectAssignments = { ...currentAssignments };
    const obj: ObjectAssignments = { ...(next[objectId] ?? {}) } as ObjectAssignments;
    const list: TrackOverride[] = Array.isArray(obj.tracks) ? [...obj.tracks] : [];
    const idx = list.findIndex(t => t.trackId === trackId);
    const base = idx >= 0 ? list[idx]! : ({ trackId } as TrackOverride);
    const merged: TrackOverride = {
      ...base,
      ...(updates as TrackOverride),
      properties: { ...(base.properties ?? {}), ...(updates.properties ?? {}) },
    };
    if (idx >= 0) list[idx] = merged; else list.push(merged);
    obj.tracks = list;
    next[objectId] = obj;

    // Persist to flow.nodes
    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (((n as any)?.data?.identifier?.id) !== nodeId) return n;
        return {
          ...n,
          data: { ...(n as any).data, perObjectAssignments: next },
        } as unknown as typeof n;
      })
    });
  }, [currentAssignments, state.flow.nodes, nodeId, updateFlow]);

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

  // Flush any pending timeline updates on unmount or node change
  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const pending = pendingRef.current;
      if (pending) {
        updateTimeline(nodeId, pending);
        pendingRef.current = null;
      }
    };
  }, [nodeId, updateTimeline]);

  const handleChange = useCallback((updates: Partial<TimelineEditorData>) => {
    const base: TimelineEditorData = pendingRef.current ?? { duration: data.duration, tracks: data.tracks };
    const merged: TimelineEditorData = {
      duration: updates.duration ?? base.duration,
      tracks: updates.tracks ?? base.tracks,
    };
    pendingRef.current = merged;
    scheduleUpdate();
  }, [data.duration, data.tracks, scheduleUpdate]);

  // Keep props stable unless nodeId changes (prevents core from reinitializing on every parent re-render)
  const coreProps = useMemo(() => ({
    animationNodeId: nodeId,
    duration: data.duration,
    tracks: data.tracks,
  }), [nodeId, data.duration, data.tracks]);

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 px-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/60">
        <div className="flex items-center gap-3">
          <div className="text-white font-medium">Timeline</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Object:</span>
            <select
              className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700"
              value={selectedObjectId ?? ''}
              onChange={(e) => setSelectedObjectId(e.target.value || null)}
            >
              <option value="">—</option>
              {upstreamObjects.map((obj) => (
                <option key={obj.data.identifier.id} value={obj.data.identifier.id}>
                  {obj.data.identifier.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="text-sm text-gray-300 hover:text-white" onClick={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}>Back to Flow</button>
      </div>
      <div className="flex-1">
        <TimelineEditorCore
          animationNodeId={coreProps.animationNodeId}
          duration={coreProps.duration}
          tracks={coreProps.tracks}
          onChange={handleChange}
          // New props for per-object assignment editing
          selectedObjectId={selectedObjectId ?? undefined}
          perObjectAssignments={currentAssignments}
          onUpdateTrackOverride={(trackId, updates) => {
            if (!selectedObjectId) return;
            updateAssignmentsForTrack(selectedObjectId, trackId, updates);
          }}
        />
      </div>
    </div>
  );
}