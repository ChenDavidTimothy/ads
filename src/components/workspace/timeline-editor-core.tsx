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
import { deepMerge } from '@/shared/utils/object-path';
import { 
  isMoveTrack, 
  isRotateTrack, 
  isScaleTrack, 
  isFadeTrack, 
  isColorTrack 
} from "@/shared/types/nodes";
import type { PerObjectAssignments, TrackOverride } from '@/shared/properties/assignments';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { BindButton } from '@/components/workspace/binding/bindings';

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
  perObjectAssignments?: PerObjectAssignments;
  onUpdateTrackOverride?: (trackId: string, updates: Partial<TrackOverride>) => void;
  // Allow parent to control/render right panel externally
  onSelectedTrackChange?: (track: AnimationTrack | null) => void;
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

export function TimelineEditorCore({ animationNodeId, duration: controlledDuration, tracks: controlledTracks, onChange, selectedObjectId, perObjectAssignments, onUpdateTrackOverride, onSelectedTrackChange }: TimelineEditorCoreProps) {
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

  useEffect(() => {
    if (typeof onSelectedTrackChange === 'function') {
      setDuration(controlledDuration);
      setTracks(controlledTracks);
    }
  }, [controlledDuration, controlledTracks, onSelectedTrackChange]);

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

  // Notify parent of selection changes when requested
  useEffect(() => {
    if (typeof onSelectedTrackChange === 'function') {
      onSelectedTrackChange(selectedTrack ?? null);
    }
  }, [selectedTrack, onSelectedTrackChange]);

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
    </div>
  );
}

interface TrackPropertiesProps {
  track: AnimationTrack;
  onChange: (updates: Partial<AnimationTrack> & { properties?: any }) => void;
  allTracks: AnimationTrack[];
  onDisplayNameChange: (trackId: string, newName: string) => boolean;
  validateDisplayName: (name: string, trackId: string) => string | null;
  trackOverride?: TrackOverride | undefined;
  animationNodeId: string;
  selectedObjectId?: string;
}

export function TrackProperties({ track, onChange, allTracks, onDisplayNameChange, validateDisplayName, trackOverride: override, animationNodeId, selectedObjectId }: TrackPropertiesProps) {
  const easingOptions = [
    { value: "linear", label: "Linear" },
    { value: "easeInOut", label: "Ease In Out" },
    { value: "easeIn", label: "Ease In" },
    { value: "easeOut", label: "Ease Out" },
  ];

  const updateProperties = useCallback(
    (
      updates: Partial<
        | MoveTrackProperties
        | RotateTrackProperties
        | ScaleTrackProperties
        | FadeTrackProperties
        | ColorTrackProperties
      >,
    ) => {
      switch (track.type) {
        case "move": {
          if (override) {
            onChange({ properties: updates as any });
          } else {
            const mergedProps: MoveTrackProperties = deepMerge(track.properties as MoveTrackProperties, updates as Partial<MoveTrackProperties>);
            onChange({ properties: mergedProps });
          }
          break;
        }
        case "rotate": {
          if (override) {
            onChange({ properties: updates as any });
          } else {
            const mergedProps: RotateTrackProperties = deepMerge(track.properties as RotateTrackProperties, updates as Partial<RotateTrackProperties>);
            onChange({ properties: mergedProps });
          }
          break;
        }
        case "scale": {
          if (override) {
            onChange({ properties: updates as any });
          } else {
            const mergedProps: ScaleTrackProperties = deepMerge(track.properties as ScaleTrackProperties, updates as Partial<ScaleTrackProperties>);
            onChange({ properties: mergedProps });
          }
          break;
        }
        case "fade": {
          if (override) {
            onChange({ properties: updates as any });
          } else {
            const mergedProps: FadeTrackProperties = deepMerge(track.properties as FadeTrackProperties, updates as Partial<FadeTrackProperties>);
            onChange({ properties: mergedProps });
          }
          break;
        }
        case "color": {
          if (override) {
            onChange({ properties: updates as any });
          } else {
            const mergedProps: ColorTrackProperties = deepMerge(track.properties as ColorTrackProperties, updates as Partial<ColorTrackProperties>);
            onChange({ properties: mergedProps });
          }
          break;
        }
        default:
          break;
      }
    },
    [track.type, track.properties, onChange, override],
  );

  // Variable discovery uses animationNodeId to mirror object discovery behavior
  const { state, updateFlow } = useWorkspace();

  const bindButton = (fieldKey: string) => {
    // Prefer track-specific key when a track is selected
    const specific = `track.${track.identifier.id}.${fieldKey}`;
    return <BindButton nodeId={animationNodeId} bindingKey={specific} objectId={selectedObjectId} />;
  };

  // Helpers to compute per-field override/bound state for labels
  const isFieldOverridden = (key: string): boolean => {
    const p = (override?.properties as any) ?? {};
    switch (key) {
      case 'move.from.x': return p?.from?.x !== undefined;
      case 'move.from.y': return p?.from?.y !== undefined;
      case 'move.to.x': return p?.to?.x !== undefined;
      case 'move.to.y': return p?.to?.y !== undefined;
      case 'rotate.from': return p?.from !== undefined;
      case 'rotate.to': return p?.to !== undefined;
      case 'scale.from': return p?.from !== undefined;
      case 'scale.to': return p?.to !== undefined;
      case 'fade.from': return p?.from !== undefined;
      case 'fade.to': return p?.to !== undefined;
      case 'color.property': return p?.property !== undefined;
      case 'color.from': return p?.from !== undefined;
      case 'color.to': return p?.to !== undefined;
      default: return false;
    }
  };
  const isFieldBound = (key: string): boolean => {
    const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === animationNodeId) as any;
    const scopedKey = `track.${track.identifier.id}.${key}`;
    const vb = (selectedObjectId ? (node?.data?.variableBindingsByObject?.[selectedObjectId] ?? {}) : (node?.data?.variableBindings ?? {})) as Record<string, { boundResultNodeId?: string }>;
    return !!(vb?.[scopedKey]?.boundResultNodeId || vb?.[key]?.boundResultNodeId);
  };
  const labelWithOverride = (base: string, key: string) => {
    const show = isFieldOverridden(key) || isFieldBound(key);
    return show ? `${base} (override)` : base;
  };

  const clearBinding = (key: string) => {
    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (((n as any).data?.identifier?.id) !== animationNodeId) return n;
        if (override && selectedObjectId) {
          const prevAll = ((n as any).data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>;
          const prev = { ...(prevAll[selectedObjectId] ?? {}) };
          delete prev[`track.${track.identifier.id}.${key}`];
          delete prev[key];
          return { ...n, data: { ...(n as any).data, variableBindingsByObject: { ...prevAll, [selectedObjectId]: prev } } } as any;
        }
        const prev = ((n as any).data?.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;
        const next = { ...prev } as typeof prev;
        delete next[`track.${track.identifier.id}.${key}`];
        delete next[key];
        return { ...n, data: { ...(n as any).data, variableBindings: next } } as any;
      })
    });
  };

  const ToggleBinding = ({ keyName }: { keyName: string }) => (
    <button className="text-[10px] text-[var(--text-secondary)] underline ml-2" onClick={() => clearBinding(keyName)}>Use manual</button>
  );

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Name editing (non-breaking): if identifier exists, allow editing */}
      {track.identifier && (
        <div className="space-y-[var(--space-2)] pb-[var(--space-3)] border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-secondary)]">Transform Name</div>
            <div className="text-xs text-[var(--text-tertiary)]">{getTransformDisplayLabel(track.type)}</div>
          </div>
          <div className="flex flex-col gap-[var(--space-1)] items-stretch">
            <input
              className="bg-[var(--surface-1)] text-[var(--text-primary)] text-sm px-[var(--space-2)] py-[var(--space-1)] rounded w-full border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)]"
              value={track.identifier.displayName}
              onChange={(e) => {
                const proposed = e.target.value;
                onChange({ identifier: { ...track.identifier!, displayName: proposed } as unknown as AnimationTrack['identifier'] });
              }}
              onBlur={(e) => {
                const proposed = e.target.value;
                const error = validateDisplayName(proposed, track.identifier.id);
                if (!error) {
                  onDisplayNameChange(track.identifier.id, proposed);
                }
              }}
            />
            {(() => {
              const err = validateDisplayName(track.identifier.displayName, track.identifier.id);
              return err ? <span className="text-xs text-[var(--text-red)]">{err}</span> : null;
            })()}
          </div>
        </div>
      )}

      {/* Easing and Timing - Two Column Layout */}
      <div className="grid grid-cols-2 gap-[var(--space-3)]">
        <SelectField
          label={labelWithOverride("Easing", `${track.type}.easing`)}
          value={(override?.easing as any) ?? track.easing}
          onChange={(easing) => onChange({ easing: easing as AnimationTrack["easing"] })}
          options={easingOptions}
        />
        <div className="space-y-[var(--space-2)]">
          <label className="block text-xs text-[var(--text-tertiary)]">Track Duration</label>
          <div className="text-sm text-[var(--text-primary)] font-medium">{track.duration.toFixed(1)}s</div>
        </div>
      </div>

      {isMoveTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Move Properties</div>
          
          {/* From Position - Two Column */}
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs text-[var(--text-secondary)] font-medium">From Position</div>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <NumberField
                label={labelWithOverride("X", "move.from.x")}
                value={(override?.properties as any)?.from?.x ?? track.properties.from.x}
                onChange={(x) => updateProperties({ from: { x } } as any)}
                defaultValue={0}
                bindAdornment={bindButton(`move.from.x`)}
              />
              <NumberField
                label={labelWithOverride("Y", "move.from.y")}
                value={(override?.properties as any)?.from?.y ?? track.properties.from.y}
                onChange={(y) => updateProperties({ from: { y } } as any)}
                defaultValue={0}
                bindAdornment={bindButton(`move.from.y`)}
              />
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px]">
              <div><ToggleBinding keyName="move.from.x" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.move.from.x`} objectId={selectedObjectId} /></div>
              <div><ToggleBinding keyName="move.from.y" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.move.from.y`} objectId={selectedObjectId} /></div>
            </div>
          </div>

          {/* To Position - Two Column */}
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs text-[var(--text-secondary)] font-medium">To Position</div>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <NumberField
                label={labelWithOverride("X", "move.to.x")}
                value={(override?.properties as any)?.to?.x ?? track.properties.to.x}
                onChange={(x) => updateProperties({ to: { x } } as any)}
                defaultValue={100}
                bindAdornment={bindButton(`move.to.x`)}
              />
              <NumberField
                label={labelWithOverride("Y", "move.to.y")}
                value={(override?.properties as any)?.to?.y ?? track.properties.to.y}
                onChange={(y) => updateProperties({ to: { y } } as any)}
                defaultValue={100}
                bindAdornment={bindButton(`move.to.y`)}
              />
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px]">
              <div><ToggleBinding keyName="move.to.x" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.move.to.x`} objectId={selectedObjectId} /></div>
              <div><ToggleBinding keyName="move.to.y" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.move.to.y`} objectId={selectedObjectId} /></div>
            </div>
          </div>
        </div>
      )}

      {isRotateTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Rotate Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <NumberField
              label={labelWithOverride("From", "rotate.from")}
              value={(override?.properties as any)?.from ?? track.properties.from}
              onChange={(from) => updateProperties({ from })}
              step={0.1}
              defaultValue={0}
              bindAdornment={bindButton(`rotate.from`)}
            />
            <NumberField
              label={labelWithOverride("To", "rotate.to")}
              value={(override?.properties as any)?.to ?? track.properties.to}
              onChange={(to) => updateProperties({ to })}
              step={0.1}
              defaultValue={1}
              bindAdornment={bindButton(`rotate.to`)}
            />
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px]">
            <div><ToggleBinding keyName="rotate.from" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.rotate.from`} objectId={selectedObjectId} /></div>
            <div><ToggleBinding keyName="rotate.to" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.rotate.to`} objectId={selectedObjectId} /></div>
          </div>
        </div>
      )}

      {isScaleTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Scale Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <NumberField
              label={labelWithOverride("From", "scale.from")}
              value={(override?.properties as any)?.from ?? track.properties.from}
              onChange={(from) => updateProperties({ from })}
              step={0.1}
              defaultValue={1}
              bindAdornment={bindButton(`scale.from`)}
            />
            <NumberField
              label={labelWithOverride("To", "scale.to")}
              value={(override?.properties as any)?.to ?? track.properties.to}
              onChange={(to) => updateProperties({ to })}
              step={0.1}
              defaultValue={2}
              bindAdornment={bindButton(`scale.to`)}
            />
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px]">
            <div><ToggleBinding keyName="scale.from" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.scale.from`} objectId={selectedObjectId} /></div>
            <div><ToggleBinding keyName="scale.to" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.scale.to`} objectId={selectedObjectId} /></div>
          </div>
        </div>
      )}

      {isFadeTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Fade Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <NumberField
              label={labelWithOverride("From", "fade.from")}
              value={(override?.properties as any)?.from ?? track.properties.from}
              onChange={(from) => updateProperties({ from })}
              step={0.05}
              defaultValue={1}
              bindAdornment={bindButton(`fade.from`)}
            />
            <NumberField
              label={labelWithOverride("To", "fade.to")}
              value={(override?.properties as any)?.to ?? track.properties.to}
              onChange={(to) => updateProperties({ to })}
              step={0.05}
              defaultValue={0}
              bindAdornment={bindButton(`fade.to`)}
            />
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px]">
            <div><ToggleBinding keyName="fade.from" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.fade.from`} objectId={selectedObjectId} /></div>
            <div><ToggleBinding keyName="fade.to" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.fade.to`} objectId={selectedObjectId} /></div>
          </div>
        </div>
      )}

      {isColorTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Color Properties</div>
          
          {/* Property Selection - Full Width */}
          <SelectField
            label={labelWithOverride("Property", "color.property")}
            value={(override?.properties as any)?.property ?? track.properties.property}
            onChange={(property) => updateProperties({ property: property as 'fill' | 'stroke' })}
            options={[
              { value: "fill", label: "Fill" },
              { value: "stroke", label: "Stroke" },
            ]}
            bindAdornment={bindButton(`color.property`)}
          />
          
          {/* Color Fields - Two Column */}
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs text-[var(--text-secondary)] font-medium">Color Values</div>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <ColorField 
                label={labelWithOverride("From", "color.from")}
                value={(override?.properties as any)?.from ?? track.properties.from} 
                onChange={(from) => updateProperties({ from })} 
                bindAdornment={bindButton(`color.from`)} 
              />
              <ColorField 
                label={labelWithOverride("To", "color.to")}
                value={(override?.properties as any)?.to ?? track.properties.to} 
                onChange={(to) => updateProperties({ to })} 
                bindAdornment={bindButton(`color.to`)} 
              />
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px]">
              <div><ToggleBinding keyName="color.from" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.color.from`} objectId={selectedObjectId} /></div>
              <div><ToggleBinding keyName="color.to" /> <BindingTag nodeId={animationNodeId} keyName={`track.${track.identifier.id}.color.to`} objectId={selectedObjectId} /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


