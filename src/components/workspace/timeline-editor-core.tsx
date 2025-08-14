"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { NumberField, SelectField, ColorField } from "@/components/ui/form-fields";
import { cn } from "@/lib/utils";
import { transformFactory } from '@/shared/registry/transforms';
import { generateTransformIdentifier, getTransformDisplayLabel, validateTransformDisplayName as validateNameHelper } from '@/lib/defaults/transforms';
import { TransformTracker } from '@/lib/flow/transform-tracking';
import type {
  AnimationTrack,
  MoveTrackProperties,
  RotateTrackProperties,
  ScaleTrackProperties,
  FadeTrackProperties,
  ColorTrackProperties,
} from "@/shared/types/nodes";
import { 
  isMoveTrack, 
  isRotateTrack, 
  isScaleTrack, 
  isFadeTrack, 
  isColorTrack 
} from "@/shared/types/nodes";
// Legacy imports removed - using granular system
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { BindButton } from '@/components/workspace/binding/bindings';
import { UnifiedTimelineProperties } from './timeline-editor-properties';

function BindingTag({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
  const { state } = useWorkspace();
  const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
  const vb = (objectId ? (node?.data?.variableBindingsByObject?.[objectId] ?? {}) : (node?.data?.variableBindings ?? {})) as Record<string, { boundResultNodeId?: string }>;
  const bound = vb?.[keyName]?.boundResultNodeId;
  if (!bound) return null;
  const name = state.flow.nodes.find(n => (n as any).data?.identifier?.id === bound)?.data?.identifier?.displayName as string | undefined;
  return <span className="ml-2 text-[10px] text-[var(--text-tertiary)]">(bound: {name ?? bound})</span>;
}

interface TimelineEditorCoreProps {
  animationNodeId: string;
  duration: number;
  tracks: AnimationTrack[];
  onChange: (updates: Partial<{ duration: number; tracks: AnimationTrack[] }>) => void;
  // Optional per-object assignment editing
  selectedObjectId?: string;
}

interface DragState {
  trackId: string;
  type: "move" | "resize-start" | "resize-end";
  startX: number;
  startTime: number;
  startDuration: number;
}

const TIMELINE_WIDTH = 800;

function isPoint2D(value: unknown): value is { x: number; y: number } {
  return typeof value === 'object' && value !== null &&
    typeof (value as Record<string, unknown>).x === 'number' &&
    typeof (value as Record<string, unknown>).y === 'number';
}

function isMoveDefaults(value: unknown): value is MoveTrackProperties {
  const v = value as Partial<MoveTrackProperties>;
  return !!v && isPoint2D(v.from) && isPoint2D(v.to);
}

function isRotateDefaults(value: unknown): value is RotateTrackProperties {
  const v = value as Partial<RotateTrackProperties>;
  return !!v && typeof v.from === 'number' && typeof v.to === 'number';
}

function isScaleDefaults(value: unknown): value is ScaleTrackProperties {
  const v = value as Partial<ScaleTrackProperties>;
  return !!v && typeof v.from === 'number' && typeof v.to === 'number';
}

function isFadeDefaults(value: unknown): value is FadeTrackProperties {
  const v = value as Partial<FadeTrackProperties>;
  return !!v && typeof v.from === 'number' && typeof v.to === 'number';
}

function isColorDefaults(value: unknown): value is ColorTrackProperties {
  const v = value as Partial<ColorTrackProperties>;
  return !!v && typeof v.from === 'string' && typeof v.to === 'string' &&
    (v.property === 'fill' || v.property === 'stroke');
}

function getDefaultTrackProperties(
  trackType: AnimationTrack["type"],
): Record<string, unknown> {
  // Use the registry system to get default properties
  const defaults = transformFactory.getDefaultProperties(trackType);
  if (!defaults) {
    throw new Error(`Unknown track type: ${String(trackType)}`);
  }
  return defaults;
}

export function TimelineEditorCore({ animationNodeId, duration: controlledDuration, tracks: controlledTracks, onChange, selectedObjectId }: TimelineEditorCoreProps) {
  const [duration, setDuration] = useState(controlledDuration);
  const [tracks, setTracks] = useState<AnimationTrack[]>(controlledTracks);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const { state, updateFlow } = useWorkspace();

  const timelineRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<TransformTracker>(new TransformTracker());
  const prevNodeIdRef = useRef<string>(animationNodeId);

  // Initialize only when the animation node changes; preserve interaction state otherwise
  useEffect(() => {
    if (prevNodeIdRef.current !== animationNodeId) {
      setDuration(controlledDuration);
      setTracks(controlledTracks);
      setSelectedTrackId(null);
      setDragState(null);
      const tracker = trackerRef.current;
      controlledTracks.forEach((t, index) => {
        tracker.trackTransformCreation(t.identifier.id, animationNodeId, index);
      });
      prevNodeIdRef.current = animationNodeId;
    }
  }, [animationNodeId, controlledDuration, controlledTracks]);

  useEffect(() => {
    const tracker = trackerRef.current;
    tracks.forEach((t, index) => {
      tracker.updateTrackIndex(t.identifier.id, index);
    });
  }, [tracks]);

  const addTrack = useCallback(
    (type: AnimationTrack["type"]) => {
      const definition = transformFactory.getTransformDefinition(type);
      const identifier = generateTransformIdentifier(type, tracks);
      const baseTrack = {
        id: identifier.id,
        startTime: 0,
        duration: Math.min(2, duration),
        easing: definition?.metadata?.defaultEasing ?? 'easeInOut',
        properties: getDefaultTrackProperties(type),
        identifier,
      };
      let newTrack: AnimationTrack;
      switch (type) {
        case 'move': {
          const props = isMoveDefaults(baseTrack.properties) ? baseTrack.properties : { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
          newTrack = { ...baseTrack, type: 'move', properties: props };
          break;
        }
        case 'rotate': {
          const props = isRotateDefaults(baseTrack.properties) ? baseTrack.properties : { from: 0, to: 1 };
          newTrack = { ...baseTrack, type: 'rotate', properties: props };
          break;
        }
        case 'scale': {
          const props = isScaleDefaults(baseTrack.properties) ? baseTrack.properties : { from: 1, to: 1.5 };
          newTrack = { ...baseTrack, type: 'scale', properties: props };
          break;
        }
        case 'fade': {
          const props = isFadeDefaults(baseTrack.properties) ? baseTrack.properties : { from: 1, to: 0.5 };
          newTrack = { ...baseTrack, type: 'fade', properties: props };
          break;
        }
        case 'color': {
          let props: ColorTrackProperties;
          if (isColorDefaults(baseTrack.properties)) props = baseTrack.properties;
          else props = { from: '#ff0000', to: '#00ff00', property: 'fill' };
          newTrack = { ...baseTrack, type: 'color', properties: props };
          break;
        }
      }
      setTracks((prev) => {
        const next = [...prev, newTrack];
        onChange({ tracks: next });
        return next;
      });
    },
    [duration, tracks, onChange]
  );

  const updateTransformDisplayName = useCallback((trackId: string, newDisplayName: string) => {
    const error = validateNameHelper(newDisplayName, trackId, tracks);
    if (error) return false;
    setTracks((prev) => prev.map((t) => (
      t.identifier.id === trackId
        ? ({ ...t, identifier: { ...t.identifier, displayName: newDisplayName } })
        : t
    )));
    return true;
  }, [tracks]);

  const validateTransformDisplayName = useCallback((name: string, trackId: string) => {
    return validateNameHelper(name, trackId, tracks);
  }, [tracks]);

  const updateTrack = useCallback(<T extends AnimationTrack>(trackId: string, updates: Partial<T>) => {
    setTracks((prev) => {
      const next = prev.map((track) => {
        if (track.identifier.id !== trackId) return track;
        if (track.type !== (updates.type ?? track.type)) return track;
        return { ...track, ...updates } as AnimationTrack;
      });
      onChange({ tracks: next });
      return next;
    });
  }, [onChange]);

  const deleteTrack = useCallback((trackId: string) => {
    setTracks((prev) => {
      const next = prev.filter((track) => track.identifier.id !== trackId);
      if (selectedTrackId === trackId) setSelectedTrackId(null);
      trackerRef.current.removeTransform(trackId);
      onChange({ tracks: next });
      return next;
    });
  }, [selectedTrackId, onChange]);

  const handleDurationImmediate = useCallback((newDuration: number) => {
    setDuration((prev) => {
      const clamped = Math.max(0.1, newDuration);
      if (clamped === prev) return prev;
      return clamped;
    });
    onChange({ duration: Math.max(0.1, newDuration), tracks });
  }, [onChange, tracks]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, trackId: string, type: DragState["type"]) => {
      e.preventDefault();
      const track = tracks.find((t) => t.identifier.id === trackId);
      if (!track) return;
      setDragState({ trackId, type, startX: e.clientX, startTime: track.startTime, startDuration: track.duration });
    },
    [tracks],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;
      const track = tracks.find((t) => t.identifier.id === dragState.trackId);
      if (!track) return;
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = (deltaX / TIMELINE_WIDTH) * duration;
      switch (dragState.type) {
        case "move": {
          const newStartTime = Math.max(0, Math.min(duration - track.duration, dragState.startTime + deltaTime));
          updateTrack(dragState.trackId, { startTime: newStartTime });
          break;
        }
        case "resize-start": {
          const newStart = Math.max(0, Math.min(dragState.startTime + dragState.startDuration - 0.1, dragState.startTime + deltaTime));
          const newDuration = dragState.startDuration - (newStart - dragState.startTime);
          updateTrack(dragState.trackId, { startTime: newStart, duration: Math.max(0.1, newDuration) });
          break;
        }
        case "resize-end": {
          const newDur = Math.max(0.1, Math.min(duration - dragState.startTime, dragState.startDuration + deltaTime));
          updateTrack(dragState.trackId, { duration: newDur });
          break;
        }
      }
    },
    [dragState, tracks, duration, updateTrack],
  );

  const handleMouseUp = useCallback(() => setDragState(null), []);

  useEffect(() => {
    if (dragState) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const selectedTrack = tracks.find((t) => t.identifier.id === selectedTrackId);

  // Disable save if any display name invalid
  const hasInvalidNames = tracks.some((t) => !!validateNameHelper(t.identifier.displayName, t.identifier.id, tracks));

  return (
    <div className="flex h-full">
      <div className="flex-1 p-[var(--space-4)] overflow-auto">
        <div className="flex items-center gap-[var(--space-4)] mb-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <NumberField
              label="Duration (seconds)"
              value={duration}
              onChange={handleDurationImmediate}
              min={0.1}
              step={0.1}
              defaultValue={3}
              className="w-32"
              bindAdornment={<BindButton nodeId={animationNodeId} bindingKey="duration" />}
            />
          </div>
          {/* Save/Cancel removed: unified manual save handled at workspace level */}
        </div>

        <div className="mb-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Add Track:</span>
            {transformFactory.getAllTransformTypes().map((type) => {
              const trackColors = transformFactory.getTrackColors();
              const trackIcons = transformFactory.getTrackIcons();
              return (
                <Button 
                  key={type} 
                  onClick={() => addTrack(type as AnimationTrack["type"])} 
                  className={cn("text-xs", trackColors[type] ?? "bg-[var(--surface-2)]")} 
                  size="sm"
                >
                  {trackIcons[type] ?? "●"} {type}
                </Button>
              );
            })}
          </div>
        </div>

        <div ref={timelineRef} className="relative bg-[var(--surface-0)] rounded-[var(--radius-md)] p-[var(--space-4)]" style={{ width: `${TIMELINE_WIDTH}px` }}>
          <div className="relative h-6 mb-[var(--space-4)]">
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div key={i} className="absolute flex flex-col items-center" style={{ left: `${(i / duration) * 100}%` }}>
                <div className="w-px h-4 bg-[var(--border-secondary)]" />
                <span className="text-xs text-[var(--text-tertiary)] mt-1">{i}s</span>
              </div>
            ))}
          </div>

          <div className="space-y-[var(--space-3)]">
            {tracks.map((track) => (
              <div key={track.identifier.id} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <span className="text-sm font-medium text-[var(--text-primary)] w-16">
                      {(() => {
                        const trackIcons = transformFactory.getTrackIcons();
                        return trackIcons[track.type] ?? "●";
                      })()} {track.type}
                    </span>
                    {selectedTrackId === track.identifier.id && (
                      <span className="text-xs bg-[var(--accent-600)] text-[var(--text-primary)] px-2 py-1 rounded-[var(--radius-sm)]">SELECTED</span>
                    )}
                  </div>
                  <Button onClick={() => deleteTrack(track.identifier.id)} variant="danger" size="sm" className="text-xs">
                    Delete
                  </Button>
                </div>

                <div className="relative h-8 bg-[var(--surface-2)] rounded">
                  <div
                    className={cn(
                      "absolute h-6 rounded cursor-move transition-all text-[var(--text-primary)]",
                      (() => {
                        const trackColors = transformFactory.getTrackColors();
                        return trackColors[track.type] ?? "bg-[var(--surface-interactive)]";
                      })(),
                      selectedTrackId === track.identifier.id ? "ring-2 ring-[var(--accent-500)] shadow-lg" : "hover:brightness-110",
                      dragState?.trackId === track.identifier.id ? "opacity-80" : "",
                    )}
                    style={{ left: `${(track.startTime / duration) * 100}%`, width: `${(track.duration / duration) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.identifier.id, "move")}
                    onClick={() => setSelectedTrackId(track.identifier.id)}
                  >
                   <div className="flex items-center justify-between h-full px-2">
                      <span className="text-xs font-medium truncate">{track.identifier.displayName}</span>
                      <span className="text-xs text-[color:rgba(248,249,250,0.8)]">{track.duration.toFixed(1)}s</span>
                    </div>
                  </div>

                  <div
                    className="absolute w-3 h-6 cursor-w-resize bg-white/30 hover:bg-white/50 rounded-l z-10"
                    style={{ left: `${(track.startTime / duration) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.identifier.id, "resize-start")}
                  />
                  <div
                    className="absolute w-3 h-6 cursor-e-resize bg-white/30 hover:bg-white/50 rounded-r z-10"
                    style={{ left: `${((track.startTime + track.duration) / duration) * 100 - (12 / TIMELINE_WIDTH) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.identifier.id, "resize-end")}
                  />
                </div>

                <div className="text-xs text-[var(--text-tertiary)] mt-1">
                  {track.startTime.toFixed(1)}s - {(track.startTime + track.duration).toFixed(1)}s
                </div>
              </div>
            ))}
          </div>

          {tracks.length === 0 && (
            <div className="text-center py-12 text-[var(--text-tertiary)]">
              <div className="text-lg mb-2">No animation tracks</div>
              <div className="text-sm mb-[var(--space-4)]">Click the colored buttons above to add animation tracks</div>
            </div>
          )}
        </div>
      </div>

      <div className="w-[var(--sidebar-width)] border-l border-[var(--border-primary)] p-[var(--space-4)] bg-[var(--surface-2)]">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Properties</h3>
        {selectedTrack ? (
          <UnifiedTimelineProperties
            nodeId={animationNodeId}
            selectedObjectId={selectedObjectId}
            selectedTrack={selectedTrack}
            onTrackChange={(updates) => {
              const nextTracks = tracks.map(t => t.identifier.id === selectedTrack.identifier.id ? ({ ...t, ...(updates as any) } as AnimationTrack) : t);
              setTracks(nextTracks);
              onChange({ tracks: nextTracks });
            }}
            onDisplayNameChange={updateTransformDisplayName}
            validateDisplayName={validateTransformDisplayName}
          />
        ) : (
          <div className="text-[var(--text-tertiary)] text-sm">Click a track to select and edit its properties</div>
        )}
      </div>
    </div>
  );
}

// TrackProperties component removed - replaced with UnifiedTimelineProperties


