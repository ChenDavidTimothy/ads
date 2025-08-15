"use client";

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { useWorkspace } from './workspace-context';
import { TimelineEditorCore } from './timeline-editor-core';
import { Button } from '@/components/ui/button';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TimelineEditorData } from '@/types/workspace-state';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { NodeData } from '@/shared/types';
import type { PerObjectAssignments, ObjectAssignments, TrackOverride } from '@/shared/properties/assignments';
import { ObjectSelectionPanel } from './common/object-selection-panel';
import { DefaultSelector } from './common/default-selector';
import type { AnimationTrack } from '@/shared/types/nodes';
import { TrackProperties } from './timeline-editor-core';
import { validateTransformDisplayName as validateNameHelper } from '@/lib/defaults/transforms';



export function TimelineEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateTimeline, updateUI, updateFlow } = useWorkspace();
  const data = state.editors.timeline[nodeId];
  const pendingRef = useRef<TimelineEditorData | null>(null);
  const rafRef = useRef<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = React.useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = React.useState<AnimationTrack | null>(null);

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
    const baseProps = (base.properties ?? {}) as Record<string, unknown>;
    const updateProps = (updates.properties ?? {}) as Record<string, unknown>;
    const mergedProps = {
      ...baseProps,
      ...updateProps,
      ...(typeof baseProps.from === 'object' && baseProps.from !== null && typeof updateProps.from === 'object' && updateProps.from !== null
        ? { from: { ...(baseProps.from as Record<string, unknown>), ...(updateProps.from as Record<string, unknown>) } }
        : {}),
      ...(typeof baseProps.to === 'object' && baseProps.to !== null && typeof updateProps.to === 'object' && updateProps.to !== null
        ? { to: { ...(baseProps.to as Record<string, unknown>), ...(updateProps.to as Record<string, unknown>) } }
        : {}),
    } as Record<string, unknown>;

    // Prune fields equal to base track defaults so only explicit changes remain
    const baseTrack = (state.editors.timeline[nodeId]?.tracks ?? []).find(t => (t as any).identifier?.id === trackId) as any;
    const prunedProps = (() => {
      if (!baseTrack) return mergedProps;
      const baseTrackProps = (baseTrack.properties ?? {}) as Record<string, unknown>;
      const copy: Record<string, unknown> = { ...mergedProps };

      // Helper to prune nested point2d-like objects (from/to)
      const pruneNested = (key: string) => {
        const mergedVal = copy[key] as any;
        const baseVal = baseTrackProps[key] as any;
        if (mergedVal && typeof mergedVal === 'object' && baseVal && typeof baseVal === 'object') {
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(mergedVal)) {
            const mv = mergedVal[k];
            const bv = baseVal[k];
            if (mv !== bv) out[k] = mv;
          }
          if (Object.keys(out).length > 0) copy[key] = out; else delete copy[key];
        } else if (mergedVal === baseVal) {
          delete copy[key];
        }
      };

      for (const key of Object.keys(copy)) {
        if (key === 'from' || key === 'to') pruneNested(key);
        else if (copy[key] === baseTrackProps[key]) delete copy[key];
      }
      return copy;
    })();

    const merged: TrackOverride = {
      ...base,
      ...(updates.easing !== undefined ? { easing: updates.easing } : {}),
      ...(updates.startTime !== undefined ? { startTime: updates.startTime } : {}),
      ...(updates.duration !== undefined ? { duration: updates.duration } : {}),
      properties: prunedProps,
    };

    // Also prune timing/easing if equal to base track
    if (baseTrack) {
      if ((merged as any).easing === baseTrack.easing) delete (merged as any).easing;
      if ((merged as any).startTime === baseTrack.startTime) delete (merged as any).startTime;
      if ((merged as any).duration === baseTrack.duration) delete (merged as any).duration;
    }

    // If no properties and no timing/easing overrides remain, drop this override entry entirely
    const hasProps = merged.properties && Object.keys(merged.properties as Record<string, unknown>).length > 0;
    const hasMeta = (merged as any).easing !== undefined || (merged as any).startTime !== undefined || (merged as any).duration !== undefined;

    if (!hasProps && !hasMeta) {
      if (idx >= 0) list.splice(idx, 1);
    } else {
      if (idx >= 0) list[idx] = merged; else list.push(merged);
    }

    obj.tracks = list;
    next[objectId] = obj;

    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (((n as any)?.data?.identifier?.id) !== nodeId) return n;
        return {
          ...n,
          data: { ...(n as any).data, perObjectAssignments: next },
        } as unknown as typeof n;
      })
    });
  }, [currentAssignments, state.flow.nodes, nodeId, updateFlow, state.editors.timeline]);

  if (!data) {
    return <div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">Timeline data not found</div>;
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
    <div className="h-full flex">
      {/* Left Sidebar - Object Selection */}
      <div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] p-[var(--space-3)] bg-[var(--surface-1)]">
        <div className="space-y-[var(--space-3)]">
          <div>
            <div className="text-xs text-[var(--text-secondary)] font-medium mb-[var(--space-2)]">Selection Mode</div>
            <DefaultSelector onClick={() => setSelectedObjectId(null)} active={selectedObjectId === null} />
          </div>
          <div className="pt-[var(--space-3)] border-t border-[var(--border-primary)]">
            <ObjectSelectionPanel
              items={upstreamObjects.map(o => ({ 
                id: o.data.identifier.id, 
                label: o.data.identifier.displayName,
                type: o.type,
                icon: getNodeDefinition(o.type!)?.rendering.icon,
                color: (o.data as any)?.color
              }))}
              selectedId={selectedObjectId}
              onSelect={(id) => setSelectedObjectId(id)}
              emptyLabel="No upstream objects"
              title="Objects"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--surface-1)]/60">
          <div className="flex items-center gap-3">
            <div className="text-[var(--text-primary)] font-medium">Timeline</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}>
            Back to Flow
          </Button>
        </div>

        {/* Timeline Editor Core */}
        <div className="flex-1">
          <TimelineEditorCore
            animationNodeId={coreProps.animationNodeId}
            duration={coreProps.duration}
            tracks={coreProps.tracks}
            onChange={handleChange}
            // Per-object assignment editing
            selectedObjectId={selectedObjectId ?? undefined}
            perObjectAssignments={currentAssignments}
            onUpdateTrackOverride={(trackId, updates) => {
              if (!selectedObjectId) return;
              updateAssignmentsForTrack(selectedObjectId, trackId, updates);
            }}
            onSelectedTrackChange={setSelectedTrack}
          />
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-[var(--sidebar-width)] border-l border-[var(--border-primary)] p-[var(--space-4)] bg-[var(--surface-1)] overflow-y-auto">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Properties</h3>
        {selectedTrack ? (
          <TrackProperties
            track={selectedTrack}
            onChange={(updates) => {
              if (selectedObjectId) {
                updateAssignmentsForTrack(selectedObjectId, selectedTrack.identifier.id, updates as any);
              } else {
                const nextTracks = (data.tracks ?? []).map(t => (t as any).identifier?.id === selectedTrack.identifier.id ? ({ ...t, ...(updates as any) } as any) : t) as any;
                handleChange({ tracks: nextTracks });
              }
            }}
            allTracks={data.tracks}
            onDisplayNameChange={(trackId, newName) => {
              const error = validateNameHelper(newName, trackId, data.tracks as AnimationTrack[]);
              if (error) return false;
              const nextTracks = (data.tracks ?? []).map(t => (t as any).identifier?.id === trackId ? ({ ...t, identifier: { ...(t as any).identifier, displayName: newName } } as any) : t) as any;
              handleChange({ tracks: nextTracks });
              return true;
            }}
            validateDisplayName={(name, trackId) => validateNameHelper(name, trackId, data.tracks as AnimationTrack[])}
            trackOverride={(() => {
              if (!selectedObjectId || !currentAssignments) return undefined;
              const obj = currentAssignments[selectedObjectId];
              const tr = obj?.tracks?.find(t => t.trackId === selectedTrack.identifier.id);
              return tr;
            })()}
            animationNodeId={nodeId}
            selectedObjectId={selectedObjectId ?? undefined}
          />
        ) : (
          <div className="text-[var(--text-tertiary)] text-sm">Click a track to select and edit its properties</div>
        )}
      </div>
    </div>
  );
}