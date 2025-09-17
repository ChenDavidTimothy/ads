'use client';

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import type { Node } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { TimelineEditorCore } from './timeline-editor-core';
import { Button } from '@/components/ui/button';
import type { TimelineEditorData } from '@/types/workspace-state';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { NodeData, AnimationNodeData, AnimationTrack } from '@/shared/types/nodes';
import type {
  PerObjectAssignments,
  ObjectAssignments,
  TrackOverride,
} from '@/shared/properties/assignments';
import { SelectionList } from '@/components/ui/selection';
import { TrackProperties } from './timeline-editor-core';
import { validateTransformDisplayName as validateNameHelper } from '@/lib/defaults/transforms';

export function TimelineEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateTimeline, updateUI, updateFlow } = useWorkspace();

  // All hooks must be called before any conditional returns
  const pendingRef = useRef<TimelineEditorData | null>(null);
  const rafRef = useRef<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = React.useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = React.useState<AnimationTrack | null>(null);

  // Get the data - this will be undefined if not found, but hooks are already called
  const data = state.editors.timeline[nodeId];

  // Find the animation node in the flow and its current assignments
  const animationNode = React.useMemo(() => {
    return state.flow.nodes.find((n) => n.data.identifier.id === nodeId) as
      | Node<AnimationNodeData>
      | undefined;
  }, [state.flow.nodes, nodeId]);

  const currentAssignments: PerObjectAssignments = React.useMemo(() => {
    return animationNode?.data?.perObjectAssignments ?? {};
  }, [animationNode?.data?.perObjectAssignments]);

  // Use enhanced object detection that understands duplication
  const upstreamObjects = React.useMemo(() => {
    const tracker = new FlowTracker();

    // Use new duplicate-aware method
    const objectDescriptors = tracker.getUpstreamObjects(
      nodeId,
      state.flow.nodes,
      state.flow.edges
    );

    // Convert to display format expected by SelectionList
    return objectDescriptors.map((obj) => ({
      data: {
        identifier: {
          id: obj.id,
          displayName: obj.displayName,
          type: obj.type,
        },
      },
      type: obj.type,
    }));
  }, [nodeId, state.flow.nodes, state.flow.edges]);

  // Log for debugging
  React.useEffect(() => {
    console.log(
      `[Timeline] Detected ${upstreamObjects.length} objects for animation node ${nodeId}:`,
      upstreamObjects.map((o) => ({
        id: o.data.identifier.id,
        name: o.data.identifier.displayName,
        type: o.data.identifier.type,
      }))
    );
  }, [upstreamObjects, nodeId]);

  const updateAssignmentsForTrack = React.useCallback(
    (objectId: string, trackId: string, updates: Partial<TrackOverride>) => {
      const next: PerObjectAssignments = { ...currentAssignments };
      const obj: ObjectAssignments = { ...(next[objectId] ?? {}) };
      const list: TrackOverride[] = Array.isArray(obj.tracks) ? [...obj.tracks] : [];
      const idx = list.findIndex((t) => t.trackId === trackId);
      const base = idx >= 0 ? list[idx]! : { trackId };
      const baseProps: Record<string, unknown> = base.properties ?? {};
      const updateProps: Record<string, unknown> = updates.properties ?? {};
      const mergedProps = {
        ...baseProps,
        ...updateProps,
        ...(typeof baseProps.from === 'object' &&
        baseProps.from !== null &&
        typeof updateProps.from === 'object' &&
        updateProps.from !== null
          ? {
              from: {
                ...(baseProps.from as Record<string, unknown>),
                ...(updateProps.from as Record<string, unknown>),
              },
            }
          : {}),
        ...(typeof baseProps.to === 'object' &&
        baseProps.to !== null &&
        typeof updateProps.to === 'object' &&
        updateProps.to !== null
          ? {
              to: {
                ...(baseProps.to as Record<string, unknown>),
                ...(updateProps.to as Record<string, unknown>),
              },
            }
          : {}),
      } as Record<string, unknown>;

      // SIMPLIFIED: any per-object edit is a manual override; do not prune equality
      const merged: TrackOverride = {
        ...base,
        ...(updates.easing !== undefined ? { easing: updates.easing } : {}),
        ...(updates.startTime !== undefined ? { startTime: updates.startTime } : {}),
        ...(updates.duration !== undefined ? { duration: updates.duration } : {}),
        properties: mergedProps,
      };
      if (idx >= 0) list[idx] = merged;
      else list.push(merged);

      obj.tracks = list;
      next[objectId] = obj;

      updateFlow({
        nodes: state.flow.nodes.map((n) => {
          if (n.data.identifier.id !== nodeId) return n;
          return {
            ...n,
            data: { ...n.data, perObjectAssignments: next },
          } as Node<NodeData>;
        }),
      });
    },
    [currentAssignments, state.flow.nodes, nodeId, updateFlow]
  );

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

  const handleChange = useCallback(
    (updates: Partial<TimelineEditorData>) => {
      if (!data) return;
      const base: TimelineEditorData = pendingRef.current ?? {
        duration: data.duration,
        tracks: data.tracks,
      };
      const merged: TimelineEditorData = {
        duration: updates.duration ?? base.duration,
        tracks: updates.tracks ?? base.tracks,
      };
      pendingRef.current = merged;
      scheduleUpdate();
    },
    [data, scheduleUpdate]
  );

  // Keep props stable unless nodeId changes (prevents core from reinitializing on every parent re-render)
  const coreProps = useMemo(
    () => ({
      animationNodeId: nodeId,
      duration: data?.duration ?? 0,
      tracks: data?.tracks ?? [],
    }),
    [nodeId, data?.duration, data?.tracks]
  );

  // Early return after all hooks have been called
  if (!data) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
        Timeline data not found
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Object Selection */}
      <div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-3)]">
        <div className="space-y-[var(--space-3)]">
          <SelectionList
            mode="single"
            items={upstreamObjects.map((o) => ({
              id: o.data.identifier.id,
              label: o.data.identifier.displayName,
            }))}
            selectedId={selectedObjectId}
            onSelect={setSelectedObjectId}
            showDefault={true}
            defaultLabel="Default"
            emptyLabel="No upstream objects"
          />

          {/* Show object count for debugging */}
          <div className="border-t border-[var(--border-primary)] pt-[var(--space-2)] text-xs text-[var(--text-tertiary)]">
            Detected: {upstreamObjects.length} object
            {upstreamObjects.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--surface-1)]/60 px-4">
          <div className="flex items-center gap-3">
            <div className="font-medium text-[var(--text-primary)]">Timeline</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateUI({
                activeTab: 'flow',
                selectedNodeId: undefined,
                selectedNodeType: undefined,
              })
            }
          >
            Back to Workspace
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
      <div className="w-[var(--sidebar-width)] overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-4)]">
        <h3 className="mb-[var(--space-4)] text-lg font-semibold text-[var(--text-primary)]">
          Properties
        </h3>
        {selectedTrack ? (
          <TrackProperties
            track={selectedTrack}
            onChange={(updates) => {
              if (selectedObjectId) {
                // Convert AnimationTrack updates to TrackOverride format
                const trackOverride: Partial<TrackOverride> = {
                  ...(updates.properties
                    ? {
                        properties: updates.properties as unknown as Record<string, unknown>,
                      }
                    : {}),
                  ...(updates.easing ? { easing: updates.easing } : {}),
                  ...(updates.startTime !== undefined ? { startTime: updates.startTime } : {}),
                  ...(updates.duration !== undefined ? { duration: updates.duration } : {}),
                };
                updateAssignmentsForTrack(
                  selectedObjectId,
                  selectedTrack.identifier.id,
                  trackOverride
                );
              } else {
                const nextTracks = data.tracks.map((t) =>
                  t.identifier.id === selectedTrack.identifier.id
                    ? ({ ...t, ...updates } as AnimationTrack)
                    : t
                );
                handleChange({ tracks: nextTracks });
              }
            }}
            onDisplayNameChange={(trackId, newName) => {
              const error = validateNameHelper(newName, trackId, data.tracks);
              if (error) return false;
              const nextTracks = data.tracks.map((t) =>
                t.identifier.id === trackId
                  ? {
                      ...t,
                      identifier: { ...t.identifier, displayName: newName },
                    }
                  : t
              );
              handleChange({ tracks: nextTracks });
              return true;
            }}
            validateDisplayName={(name, trackId) => validateNameHelper(name, trackId, data.tracks)}
            trackOverride={(() => {
              if (!selectedObjectId || !currentAssignments) return undefined;
              const obj = currentAssignments[selectedObjectId];
              const tr = obj?.tracks?.find((t) => t.trackId === selectedTrack.identifier.id);
              return tr;
            })()}
            animationNodeId={nodeId}
            selectedObjectId={selectedObjectId ?? undefined}
          />
        ) : (
          <div className="text-sm text-[var(--text-tertiary)]">
            Click a track to select and edit its properties
          </div>
        )}
      </div>
    </div>
  );
}
