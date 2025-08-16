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
import { BindButton } from '@/components/workspace/binding/bindings';
import { Badge } from "@/components/ui/badge";

function BindingBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
  const { state } = useWorkspace();
  const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
  const vb = (objectId ? (node?.data?.variableBindingsByObject?.[objectId] ?? {}) : (node?.data?.variableBindings ?? {})) as Record<string, { boundResultNodeId?: string }>;
  const bound = vb?.[keyName]?.boundResultNodeId;
  if (!bound) return null;
  const name = state.flow.nodes.find(n => (n as any).data?.identifier?.id === bound)?.data?.identifier?.displayName as string | undefined;
  return (
    <Badge variant="bound">{name ? `Bound: ${name}` : 'Bound'}</Badge>
  );
}

function OverrideBadge() {
  return (
    <Badge variant="manual">Manual</Badge>
  );
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
  return !!v && typeof v.property === 'string' && typeof v.from === 'string' && typeof v.to === 'string';
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
  const [localDragTracks, setLocalDragTracks] = useState<AnimationTrack[]>([]); // Local state for smooth dragging
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
      setLocalDragTracks([]);
      const tracker = trackerRef.current;
      controlledTracks.forEach((t, index) => {
        tracker.trackTransformCreation(t.identifier.id, animationNodeId, index);
      });
      prevNodeIdRef.current = animationNodeId;
    }
  }, [animationNodeId, controlledDuration, controlledTracks]);

  // Use local tracks during drag for smooth performance
  const displayTracks = dragState ? localDragTracks : tracks;

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

  const validateTransformDisplayName = useCallback((name: string, trackId: string) => {
    return validateNameHelper(name, trackId, tracks);
  }, [tracks]);

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
      // Initialize local drag state for smooth updates
      setLocalDragTracks(tracks);
    },
    [tracks],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState || !localDragTracks.length) return;
      const track = localDragTracks.find((t) => t.identifier.id === dragState.trackId);
      if (!track) return;
      
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = (deltaX / TIMELINE_WIDTH) * duration;
      
      // Update local state immediately for smooth visual feedback
      setLocalDragTracks((prev) => prev.map((t) => {
        if (t.identifier.id !== dragState.trackId) return t;
        
        switch (dragState.type) {
          case "move": {
            const newStartTime = Math.max(0, Math.min(duration - t.duration, dragState.startTime + deltaTime));
            return { ...t, startTime: newStartTime };
          }
          case "resize-start": {
            const newStart = Math.max(0, Math.min(dragState.startTime + dragState.startDuration - 0.1, dragState.startTime + deltaTime));
            const newDuration = dragState.startDuration - (newStart - dragState.startTime);
            return { ...t, startTime: newStart, duration: Math.max(0.1, newDuration) };
          }
          case "resize-end": {
            const newDur = Math.max(0.1, Math.min(duration - dragState.startTime, dragState.startDuration + deltaTime));
            return { ...t, duration: newDur };
          }
          default:
            return t;
        }
      }));
    },
    [dragState, localDragTracks, duration],
  );

  const handleMouseUp = useCallback(() => {
    if (dragState && localDragTracks.length > 0) {
      // Update parent with final drag state
      onChange({ tracks: localDragTracks });
      setTracks(localDragTracks);
    }
    setDragState(null);
    setLocalDragTracks([]);
  }, [dragState, localDragTracks, onChange]);

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
              disabled={(() => {
                const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === animationNodeId) as any;
                const vb = (node?.data?.variableBindings ?? {}) as Record<string, { boundResultNodeId?: string }>;
                return !!vb?.['duration']?.boundResultNodeId;
              })()}
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
                  className={cn(
                    "text-xs font-medium border border-[var(--border-primary)] transition-all",
                    trackColors[type] ?? "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)]"
                  )} 
                  size="sm"
                >
                  {trackIcons[type] ?? "●"} {type}
                </Button>
              );
            })}
          </div>
        </div>

        <div ref={timelineRef} className="relative bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-[var(--radius-md)] p-[var(--space-4)] shadow-glass" style={{ width: `${TIMELINE_WIDTH}px` }}>
          <div className="relative h-6 mb-[var(--space-4)]">
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div key={i} className="absolute flex flex-col items-center" style={{ left: `${(i / duration) * 100}%` }}>
                <div className="w-px h-4 bg-[var(--border-secondary)]" />
                <span className="text-xs text-[var(--text-tertiary)] mt-1">{i}s</span>
              </div>
            ))}
          </div>

          <div className="space-y-[var(--space-3)]">
            {displayTracks.map((track) => (
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
                      <span className="text-xs bg-[var(--accent-primary)] text-[var(--text-primary)] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)] font-medium">SELECTED</span>
                    )}
                  </div>
                  <Button onClick={() => deleteTrack(track.identifier.id)} variant="danger" size="sm" className="text-xs">
                    Delete
                  </Button>
                </div>

                <div className="relative h-8 bg-[var(--surface-2)] border border-[var(--border-secondary)] rounded-[var(--radius-sm)]">
                  <div
                    className={cn(
                      "absolute h-6 rounded-[var(--radius-sm)] cursor-move text-[var(--text-primary)] border border-transparent",
                      (() => {
                        const trackColors = transformFactory.getTrackColors();
                        return trackColors[track.type] ?? "bg-[var(--surface-interactive)]";
                      })(),
                      selectedTrackId === track.identifier.id 
                        ? "border-[var(--accent-primary)] shadow-[0_0_20px_var(--purple-shadow-medium),0_4px_12px_var(--purple-shadow-subtle)]" 
                        : "hover:brightness-110 hover:border-[var(--border-accent)]",
                      dragState?.trackId === track.identifier.id ? "opacity-80" : "",
                    )}
                    style={{ left: `${(track.startTime / duration) * 100}%`, width: `${(track.duration / duration) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.identifier.id, "move")}
                    onClick={() => setSelectedTrackId(track.identifier.id)}
                  >
                   <div className="flex items-center justify-between h-full px-[var(--space-2)]">
                      <span className="text-xs font-medium truncate">{track.identifier.displayName}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{track.duration.toFixed(1)}s</span>
                    </div>
                  </div>

                  <div
                    className="absolute w-1 h-6 cursor-w-resize bg-[var(--surface-1)] border border-[var(--border-primary)] hover:bg-[var(--surface-interactive)] hover:border-[var(--accent-primary)] rounded-l-[var(--radius-sm)] z-10 transition-colors"
                    style={{ left: `${(track.startTime / duration) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.identifier.id, "resize-start")}
                  />
                  <div
                    className="absolute w-1 h-6 cursor-e-resize bg-[var(--surface-1)] border border-[var(--border-primary)] hover:bg-[var(--surface-interactive)] hover:border-[var(--accent-primary)] rounded-r-[var(--radius-sm)] z-10 transition-colors"
                    style={{ left: `${((track.startTime + track.duration) / duration) * 100 - (4 / TIMELINE_WIDTH) * 100}%`, top: "1px" }}
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
  onChange: (updates: Partial<AnimationTrack>) => void;
  allTracks: AnimationTrack[];
  onDisplayNameChange: (trackId: string, newName: string) => boolean;
  validateDisplayName: (name: string, trackId: string) => string | null;
  trackOverride?: TrackOverride;
  animationNodeId: string;
  selectedObjectId?: string;
}

export function TrackProperties({ track, onChange, allTracks, onDisplayNameChange, validateDisplayName, trackOverride: override, animationNodeId, selectedObjectId }: TrackPropertiesProps) {
  const [editingName, setEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(track.identifier.displayName);

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

  const isBound = (fieldKey: string): boolean => {
    const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === animationNodeId) as any;
    const scoped = `track.${track.identifier.id}.${fieldKey}`;
    if (selectedObjectId) {
      const vbObj = (node?.data?.variableBindingsByObject?.[selectedObjectId] ?? {}) as Record<string, { boundResultNodeId?: string }>;
      return !!(vbObj?.[scoped]?.boundResultNodeId || vbObj?.[fieldKey]?.boundResultNodeId);
    }
    const vb = (node?.data?.variableBindings ?? {}) as Record<string, { boundResultNodeId?: string }>;
    return !!(vb?.[scoped]?.boundResultNodeId || vb?.[fieldKey]?.boundResultNodeId);
  };

  // Helper to get value for bound fields - blank if bound, normal value if not
  const getTrackFieldValue = (fieldKey: string, overrideValue: any, defaultValue: any) => {
    if (isBound(fieldKey)) return undefined; // Blank when bound
    return overrideValue ?? defaultValue;
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
  const labelWithOverride = (base: string) => {
    return base;
  };

  const FieldBadges = ({ keyName }: { keyName: string }) => (
    <div className="flex items-center gap-[var(--space-1)]">
      {isFieldOverridden(keyName) && <OverrideBadge />}
      <BindingBadge nodeId={animationNodeId} keyName={`track.${track.identifier.id}.${keyName}`} objectId={selectedObjectId} />
    </div>
  );

  const leftBorderClass = (keyName: string) => (
    isFieldBound(keyName) ? 'border-l-2 border-[var(--accent-secondary)]' : (isFieldOverridden(keyName) ? 'border-l-2 border-[var(--warning-600)]' : '')
  );

  // Legacy ToggleBinding UI removed in favor of centralized reset in Bind menu

  const handleSaveDisplayName = () => {
    const success = onDisplayNameChange(track.identifier.id, tempDisplayName);
    if (success) {
      setEditingName(false);
    }
  };

  const handleCancelEdit = () => {
    setTempDisplayName(track.identifier.displayName);
    setEditingName(false);
  };

  const currentError = editingName ? validateDisplayName(tempDisplayName, track.identifier.id) : null;

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
            {editingName ? (
              <>
                <input
                  className="glass-input w-full focus:ring-2 focus:ring-[var(--accent-primary)]"
                  value={tempDisplayName}
                  onChange={(e) => setTempDisplayName(e.target.value)}
                  placeholder="Enter transform name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !currentError) {
                      handleSaveDisplayName();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  autoFocus
                />
                {currentError && (
                  <div className="text-xs text-red-400">{currentError}</div>
                )}
                <div className="flex gap-[var(--space-2)]">
                  <Button
                    onClick={handleSaveDisplayName}
                    disabled={!!currentError}
                    variant="primary"
                    size="sm"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    variant="secondary"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-primary)] font-medium">
                  {track.identifier.displayName}
                </span>
                <Button
                  onClick={() => setEditingName(true)}
                  variant="minimal"
                  size="sm"
                >
                  Edit
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Easing and Timing - Two Column Layout */}
      <div className="grid grid-cols-2 gap-[var(--space-3)]">
        <SelectField
          label={labelWithOverride("Easing")}
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
                label={labelWithOverride("X")}
                value={getTrackFieldValue("move.from.x", (override?.properties as any)?.from?.x, track.properties.from.x)}
                onChange={(x) => updateProperties({ from: { x } } as any)}
                defaultValue={0}
                bindAdornment={bindButton(`move.from.x`)}
                disabled={isBound('move.from.x')}
                inputClassName={leftBorderClass('move.from.x')}
                className=""
              />
              <NumberField
                label={labelWithOverride("Y")}
                value={getTrackFieldValue("move.from.y", (override?.properties as any)?.from?.y, track.properties.from.y)}
                onChange={(y) => updateProperties({ from: { y } } as any)}
                defaultValue={0}
                bindAdornment={bindButton(`move.from.y`)}
                disabled={isBound('move.from.y')}
                inputClassName={leftBorderClass('move.from.y')}
              />
            </div>
            
          </div>

          {/* To Position - Two Column */}
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs text-[var(--text-secondary)] font-medium">To Position</div>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <NumberField
                label={labelWithOverride("X")}
                value={getTrackFieldValue("move.to.x", (override?.properties as any)?.to?.x, track.properties.to.x)}
                onChange={(x) => updateProperties({ to: { x } } as any)}
                defaultValue={100}
                bindAdornment={bindButton(`move.to.x`)}
                disabled={isBound('move.to.x')}
                inputClassName={leftBorderClass('move.to.x')}
              />
              <NumberField
                label={labelWithOverride("Y")}
                value={getTrackFieldValue("move.to.y", (override?.properties as any)?.to?.y, track.properties.to.y)}
                onChange={(y) => updateProperties({ to: { y } } as any)}
                defaultValue={100}
                bindAdornment={bindButton(`move.to.y`)}
                disabled={isBound('move.to.y')}
                inputClassName={leftBorderClass('move.to.y')}
              />
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
              <FieldBadges keyName="move.to.x" />
              <FieldBadges keyName="move.to.y" />
            </div>
          </div>
        </div>
      )}

      {isRotateTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Rotate Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <NumberField
              label={labelWithOverride("From")}
              value={getTrackFieldValue("rotate.from", (override?.properties as any)?.from, track.properties.from)}
              onChange={(from) => updateProperties({ from })}
              step={0.1}
              defaultValue={0}
              bindAdornment={bindButton(`rotate.from`)}
              disabled={isBound('rotate.from')}
              inputClassName={leftBorderClass('rotate.from')}
            />
            <NumberField
              label={labelWithOverride("To")}
              value={getTrackFieldValue("rotate.to", (override?.properties as any)?.to, track.properties.to)}
              onChange={(to) => updateProperties({ to })}
              step={0.1}
              defaultValue={1}
              bindAdornment={bindButton(`rotate.to`)}
              disabled={isBound('rotate.to')}
              inputClassName={leftBorderClass('rotate.to')}
            />
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
            <FieldBadges keyName="rotate.from" />
            <FieldBadges keyName="rotate.to" />
          </div>
        </div>
      )}

      {isScaleTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Scale Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <NumberField
              label={labelWithOverride("From")}
              value={getTrackFieldValue("scale.from", (override?.properties as any)?.from, track.properties.from)}
              onChange={(from) => updateProperties({ from })}
              step={0.1}
              defaultValue={1}
              bindAdornment={bindButton(`scale.from`)}
              disabled={isBound('scale.from')}
              inputClassName={leftBorderClass('scale.from')}
            />
            <NumberField
              label={labelWithOverride("To")}
              value={getTrackFieldValue("scale.to", (override?.properties as any)?.to, track.properties.to)}
              onChange={(to) => updateProperties({ to })}
              step={0.1}
              defaultValue={2}
              bindAdornment={bindButton(`scale.to`)}
              disabled={isBound('scale.to')}
              inputClassName={leftBorderClass('scale.to')}
            />
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
            <FieldBadges keyName="scale.from" />
            <FieldBadges keyName="scale.to" />
          </div>
        </div>
      )}

      {isFadeTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Fade Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <NumberField
              label={labelWithOverride("From")}
              value={getTrackFieldValue("fade.from", (override?.properties as any)?.from, track.properties.from)}
              onChange={(from) => updateProperties({ from })}
              step={0.05}
              defaultValue={1}
              bindAdornment={bindButton(`fade.from`)}
              disabled={isBound('fade.from')}
              inputClassName={leftBorderClass('fade.from')}
            />
            <NumberField
              label={labelWithOverride("To")}
              value={getTrackFieldValue("fade.to", (override?.properties as any)?.to, track.properties.to)}
              onChange={(to) => updateProperties({ to })}
              step={0.05}
              defaultValue={0}
              bindAdornment={bindButton(`fade.to`)}
              disabled={isBound('fade.to')}
              inputClassName={leftBorderClass('fade.to')}
            />
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
            <FieldBadges keyName="fade.from" />
            <FieldBadges keyName="fade.to" />
          </div>
        </div>
      )}

      {isColorTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-[var(--space-2)]">Color Properties</div>
          
          {/* Property Selection - Full Width */}
          <SelectField
            label={labelWithOverride("Property")}
            value={getTrackFieldValue("color.property", (override?.properties as any)?.property, track.properties.property)}
            onChange={(property) => updateProperties({ property: property as 'fill' | 'stroke' })}
            options={[
              { value: "fill", label: "Fill" },
              { value: "stroke", label: "Stroke" },
            ]}
            bindAdornment={bindButton(`color.property`)}
            disabled={isBound('color.property')}
            inputClassName={leftBorderClass('color.property')}
          />
          
          {/* Color Fields - Two Column */}
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs text-[var(--text-secondary)] font-medium">Color Values</div>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <ColorField 
                label={labelWithOverride("From")}
                value={getTrackFieldValue("color.from", (override?.properties as any)?.from, track.properties.from)} 
                onChange={(from) => updateProperties({ from })} 
                bindAdornment={bindButton(`color.from`)} 
                disabled={isBound('color.from')}
                inputClassName={leftBorderClass('color.from')}
              />
              <ColorField 
                label={labelWithOverride("To")}
                value={getTrackFieldValue("color.to", (override?.properties as any)?.to, track.properties.to)} 
                onChange={(to) => updateProperties({ to })} 
                bindAdornment={bindButton(`color.to`)} 
                disabled={isBound('color.to')}
                inputClassName={leftBorderClass('color.to')}
              />
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
              <FieldBadges keyName="color.from" />
              <FieldBadges keyName="color.to" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


