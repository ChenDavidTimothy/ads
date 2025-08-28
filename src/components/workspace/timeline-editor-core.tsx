"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  SelectField,
  ColorField,
} from "@/components/ui/form-fields";
import { cn } from "@/lib/utils";
import { transformFactory } from "@/shared/registry/transforms";
import {
  generateTransformIdentifier,
  getTransformDisplayLabel,
} from "@/lib/defaults/transforms";
import { TransformTracker } from "@/lib/flow/transform-tracking";
import type {
  AnimationTrack,
  MoveTrackProperties,
  RotateTrackProperties,
  ScaleTrackProperties,
  FadeTrackProperties,
  ColorTrackProperties,
  AnimationNodeData,
} from "@/shared/types/nodes";
import { deepMerge } from "@/shared/utils/object-path";
import {
  isMoveTrack,
  isRotateTrack,
  isScaleTrack,
  isFadeTrack,
  isColorTrack,
} from "@/shared/types/nodes";
import type {
  PerObjectAssignments,
  TrackOverride,
} from "@/shared/properties/assignments";
import { useWorkspace } from "./workspace-context";
import {
  BindButton,
  useVariableBinding,
} from "@/components/workspace/binding/bindings";
import { Badge } from "@/components/ui/badge";

function BindingBadge({
  nodeId,
  keyName,
  objectId,
}: {
  nodeId: string;
  keyName: string;
  objectId?: string;
}) {
  const { state } = useWorkspace();
  const { resetToDefault } = useVariableBinding(nodeId, objectId);

  const node = state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId);
  if (!node) return null;

  const animationData = node.data as AnimationNodeData;
  const vb = objectId
    ? (animationData.variableBindingsByObject?.[objectId] ?? {})
    : (animationData.variableBindings ?? {});
  let bound = vb?.[keyName]?.boundResultNodeId;
  if (!bound && objectId === undefined) {
    // already reading global
  }
  if (!bound && objectId !== undefined) {
    // Fallback to global default binding for inherited badge
    const node = state.flow.nodes.find(
      (n) => n.data?.identifier?.id === nodeId,
    );
    if (node) {
      const animationData = node.data as AnimationNodeData;
      const globalVb = (animationData.variableBindings ?? {}) as Record<
        string,
        { boundResultNodeId?: string }
      >;
      bound = globalVb?.[keyName]?.boundResultNodeId;
    }
  }
  if (!bound) return null;
  const boundNode = state.flow.nodes.find(
    (n) => n.data?.identifier?.id === bound,
  );
  const name = boundNode?.data?.identifier?.displayName;

  return (
    <Badge variant="bound" onRemove={() => resetToDefault(keyName)}>
      {name ? `Bound: ${name}` : "Bound"}
    </Badge>
  );
}

function OverrideBadge({
  animationNodeId,
  trackId,
  keyName,
  selectedObjectId,
}: {
  animationNodeId: string;
  trackId: string;
  keyName: string;
  selectedObjectId?: string;
}) {
  const { resetToDefault } = useVariableBinding(
    animationNodeId,
    selectedObjectId,
  );

  return (
    <Badge
      variant="manual"
      onRemove={() => resetToDefault(`track.${trackId}.${keyName}`)}
    >
      Manual
    </Badge>
  );
}

interface TimelineEditorCoreProps {
  animationNodeId: string;
  duration: number;
  tracks: AnimationTrack[];
  onChange: (
    updates: Partial<{ duration: number; tracks: AnimationTrack[] }>,
  ) => void;
  // Optional per-object assignment editing
  selectedObjectId?: string;
  perObjectAssignments?: PerObjectAssignments;
  onUpdateTrackOverride?: (
    trackId: string,
    updates: Partial<TrackOverride>,
  ) => void;
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
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).x === "number" &&
    typeof (value as Record<string, unknown>).y === "number"
  );
}

function isMoveDefaults(value: unknown): value is MoveTrackProperties {
  const v = value as Partial<MoveTrackProperties>;
  return !!v && isPoint2D(v.from) && isPoint2D(v.to);
}

function isRotateDefaults(value: unknown): value is RotateTrackProperties {
  const v = value as Partial<RotateTrackProperties>;
  return !!v && typeof v.from === "number" && typeof v.to === "number";
}

function isScaleDefaults(value: unknown): value is ScaleTrackProperties {
  const v = value as Partial<ScaleTrackProperties>;
  return !!v && typeof v.from === "number" && typeof v.to === "number";
}

function isFadeDefaults(value: unknown): value is FadeTrackProperties {
  const v = value as Partial<FadeTrackProperties>;
  return !!v && typeof v.from === "number" && typeof v.to === "number";
}

function isColorDefaults(value: unknown): value is ColorTrackProperties {
  const v = value as Partial<ColorTrackProperties>;
  return (
    !!v &&
    typeof v.property === "string" &&
    typeof v.from === "string" &&
    typeof v.to === "string"
  );
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

export function TimelineEditorCore({
  animationNodeId,
  duration: controlledDuration,
  tracks: controlledTracks,
  onChange,
  selectedObjectId: _selectedObjectId,
  perObjectAssignments: _perObjectAssignments,
  onUpdateTrackOverride: _onUpdateTrackOverride,
  onSelectedTrackChange,
}: TimelineEditorCoreProps) {
  const [duration, setDuration] = useState(controlledDuration);
  const [tracks, setTracks] = useState<AnimationTrack[]>(controlledTracks);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [localDragTracks, setLocalDragTracks] = useState<AnimationTrack[]>([]); // Local state for smooth dragging
  const { state } = useWorkspace();

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
    if (typeof onSelectedTrackChange === "function") {
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
        easing: definition?.metadata?.defaultEasing ?? "easeInOut",
        properties: getDefaultTrackProperties(type),
        identifier,
      };
      let newTrack: AnimationTrack;
      switch (type) {
        case "move": {
          const props = isMoveDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
          newTrack = { ...baseTrack, type: "move", properties: props };
          break;
        }
        case "rotate": {
          const props = isRotateDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: 0, to: 1 };
          newTrack = { ...baseTrack, type: "rotate", properties: props };
          break;
        }
        case "scale": {
          const props = isScaleDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: 1, to: 1.5 };
          newTrack = { ...baseTrack, type: "scale", properties: props };
          break;
        }
        case "fade": {
          const props = isFadeDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: 1, to: 0.5 };
          newTrack = { ...baseTrack, type: "fade", properties: props };
          break;
        }
        case "color": {
          let props: ColorTrackProperties;
          if (isColorDefaults(baseTrack.properties))
            props = baseTrack.properties;
          else props = { from: "#ff0000", to: "#00ff00", property: "fill" };
          newTrack = { ...baseTrack, type: "color", properties: props };
          break;
        }
      }
      setTracks((prev) => {
        const next = [...prev, newTrack];
        onChange({ tracks: next });
        return next;
      });
    },
    [duration, tracks, onChange],
  );

  const deleteTrack = useCallback(
    (trackId: string) => {
      setTracks((prev) => {
        const next = prev.filter((track) => track.identifier.id !== trackId);
        if (selectedTrackId === trackId) setSelectedTrackId(null);
        trackerRef.current.removeTransform(trackId);
        onChange({ tracks: next });
        return next;
      });
    },
    [selectedTrackId, onChange],
  );

  const handleDurationImmediate = useCallback(
    (newDuration: number) => {
      setDuration((prev) => {
        const clamped = Math.max(0.1, newDuration);
        if (clamped === prev) return prev;
        return clamped;
      });
      onChange({ duration: Math.max(0.1, newDuration), tracks });
    },
    [onChange, tracks],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, trackId: string, type: DragState["type"]) => {
      e.preventDefault();
      const track = tracks.find((t) => t.identifier.id === trackId);
      if (!track) return;
      setDragState({
        trackId,
        type,
        startX: e.clientX,
        startTime: track.startTime,
        startDuration: track.duration,
      });
      // Initialize local drag state for smooth updates
      setLocalDragTracks(tracks);
    },
    [tracks],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState || !localDragTracks.length) return;
      const track = localDragTracks.find(
        (t) => t.identifier.id === dragState.trackId,
      );
      if (!track) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = (deltaX / TIMELINE_WIDTH) * duration;

      // Update local state immediately for smooth visual feedback
      setLocalDragTracks((prev) =>
        prev.map((t) => {
          if (t.identifier.id !== dragState.trackId) return t;

          switch (dragState.type) {
            case "move": {
              const newStartTime = Math.max(
                0,
                Math.min(
                  duration - t.duration,
                  dragState.startTime + deltaTime,
                ),
              );
              return { ...t, startTime: newStartTime };
            }
            case "resize-start": {
              const newStart = Math.max(
                0,
                Math.min(
                  dragState.startTime + dragState.startDuration - 0.1,
                  dragState.startTime + deltaTime,
                ),
              );
              const newDuration =
                dragState.startDuration - (newStart - dragState.startTime);
              return {
                ...t,
                startTime: newStart,
                duration: Math.max(0.1, newDuration),
              };
            }
            case "resize-end": {
              const newDur = Math.max(
                0.1,
                Math.min(
                  duration - dragState.startTime,
                  dragState.startDuration + deltaTime,
                ),
              );
              return { ...t, duration: newDur };
            }
            default:
              return t;
          }
        }),
      );
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
    if (typeof onSelectedTrackChange === "function") {
      onSelectedTrackChange(selectedTrack ?? null);
    }
  }, [selectedTrack, onSelectedTrackChange]);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-[var(--space-4)]">
        <div className="mb-[var(--space-4)] flex items-center gap-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <NumberField
              label="Duration (seconds)"
              value={duration}
              onChange={handleDurationImmediate}
              min={0.1}
              step={0.1}
              defaultValue={3}
              className="w-32"
              bindAdornment={
                <BindButton nodeId={animationNodeId} bindingKey="duration" />
              }
              disabled={(() => {
                const node = state.flow.nodes.find(
                  (n) => n.data?.identifier?.id === animationNodeId,
                );
                if (!node) return false;
                const animationData = node.data as AnimationNodeData;
                const vb = animationData.variableBindings ?? {};
                return !!vb?.duration?.boundResultNodeId;
              })()}
            />
          </div>
          {/* Save/Cancel removed: unified manual save handled at workspace level */}
        </div>

        <div className="mb-[var(--space-4)]">
          <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)]">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Add Track:
            </span>
            {transformFactory.getAllTransformTypes().map((type) => {
              const trackColors = transformFactory.getTrackColors();
              const trackIcons = transformFactory.getTrackIcons();
              return (
                <Button
                  key={type}
                  onClick={() => addTrack(type as AnimationTrack["type"])}
                  className={cn(
                    "border border-[var(--border-primary)] text-xs font-medium transition-all",
                    trackColors[type] ??
                      "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)]",
                  )}
                  size="sm"
                >
                  {trackIcons[type] ?? "●"} {type}
                </Button>
              );
            })}
          </div>
        </div>

        <div
          ref={timelineRef}
          className="shadow-glass relative rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-4)]"
          style={{ width: `${TIMELINE_WIDTH}px` }}
        >
          <div className="relative mb-[var(--space-4)] h-6">
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: `${(i / duration) * 100}%` }}
              >
                <div className="h-4 w-px bg-[var(--border-secondary)]" />
                <span className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {i}s
                </span>
              </div>
            ))}
          </div>

          <div className="max-h-[60vh] space-y-[var(--space-3)] overflow-y-auto pr-[var(--space-2)] scrollbar-elegant">
            {displayTracks.map((track) => (
              <div key={track.identifier.id} className="relative">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <span className="w-16 text-sm font-medium text-[var(--text-primary)]">
                      {(() => {
                        const trackIcons = transformFactory.getTrackIcons();
                        return trackIcons[track.type] ?? "●";
                      })()}{" "}
                      {track.type}
                    </span>
                    {selectedTrackId === track.identifier.id && (
                      <Badge variant="result">SELECTED</Badge>
                    )}
                  </div>
                  <Button
                    onClick={() => deleteTrack(track.identifier.id)}
                    variant="danger"
                    size="sm"
                    className="text-xs"
                  >
                    Delete
                  </Button>
                </div>

                <div className="relative h-8 rounded-[var(--radius-sm)] border border-[var(--border-secondary)] bg-[var(--surface-2)]">
                  <div
                    className={cn(
                      "absolute h-6 cursor-move rounded-[var(--radius-sm)] border border-transparent text-[var(--text-primary)]",
                      (() => {
                        const trackColors = transformFactory.getTrackColors();
                        return (
                          trackColors[track.type] ??
                          "bg-[var(--surface-interactive)]"
                        );
                      })(),
                      selectedTrackId === track.identifier.id
                        ? "border-[var(--accent-primary)] shadow-[0_0_20px_var(--purple-shadow-medium),0_4px_12px_var(--purple-shadow-subtle)]"
                        : "hover:border-[var(--border-accent)] hover:brightness-110",
                      dragState?.trackId === track.identifier.id
                        ? "opacity-80"
                        : "",
                    )}
                    style={{
                      left: `${(track.startTime / duration) * 100}%`,
                      width: `${(track.duration / duration) * 100}%`,
                      top: "1px",
                    }}
                    onMouseDown={(e) =>
                      handleMouseDown(e, track.identifier.id, "move")
                    }
                    onClick={() => setSelectedTrackId(track.identifier.id)}
                  >
                    <div className="flex h-full items-center justify-between px-[var(--space-2)]">
                      <span className="truncate text-xs font-medium">
                        {track.identifier.displayName}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {track.duration.toFixed(1)}s
                      </span>
                    </div>
                  </div>

                  <div
                    className="absolute z-10 h-6 w-1 cursor-w-resize rounded-l-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-1)] transition-colors hover:border-[var(--accent-primary)] hover:bg-[var(--surface-interactive)]"
                    style={{
                      left: `${(track.startTime / duration) * 100}%`,
                      top: "1px",
                    }}
                    onMouseDown={(e) =>
                      handleMouseDown(e, track.identifier.id, "resize-start")
                    }
                  />
                  <div
                    className="absolute z-10 h-6 w-1 cursor-e-resize rounded-r-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-1)] transition-colors hover:border-[var(--accent-primary)] hover:bg-[var(--surface-interactive)]"
                    style={{
                      left: `${((track.startTime + track.duration) / duration) * 100 - (4 / TIMELINE_WIDTH) * 100}%`,
                      top: "1px",
                    }}
                    onMouseDown={(e) =>
                      handleMouseDown(e, track.identifier.id, "resize-end")
                    }
                  />
                </div>

                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {track.startTime.toFixed(1)}s -{" "}
                  {(track.startTime + track.duration).toFixed(1)}s
                </div>
              </div>
            ))}
            {tracks.length === 0 && (
              <div className="py-[var(--space-8)] text-center text-[var(--text-tertiary)]">
                <div className="mb-2 text-lg">No animation tracks</div>
                <div className="mb-[var(--space-4)] text-sm">
                  Click the colored buttons above to add animation tracks
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TrackPropertiesProps {
  track: AnimationTrack;
  onChange: (updates: Partial<AnimationTrack>) => void;
  onDisplayNameChange: (trackId: string, newName: string) => boolean;
  validateDisplayName: (name: string, trackId: string) => string | null;
  trackOverride?: TrackOverride;
  animationNodeId: string;
  selectedObjectId?: string;
}

export function TrackProperties({
  track,
  onChange,
  onDisplayNameChange,
  validateDisplayName,
  trackOverride: override,
  animationNodeId,
  selectedObjectId,
}: TrackPropertiesProps) {
  const [editingName, setEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(
    track.identifier.displayName,
  );

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
            onChange({ properties: updates as MoveTrackProperties });
          } else {
            const mergedProps = deepMerge(
              track.properties,
              updates,
            ) as MoveTrackProperties;
            onChange({ properties: mergedProps });
          }
          break;
        }
        case "rotate": {
          if (override) {
            onChange({ properties: updates as RotateTrackProperties });
          } else {
            const mergedProps = deepMerge(
              track.properties,
              updates,
            ) as RotateTrackProperties;
            onChange({ properties: mergedProps });
          }
          break;
        }
        case "scale": {
          if (override) {
            onChange({ properties: updates as ScaleTrackProperties });
          } else {
            const mergedProps = deepMerge(
              track.properties,
              updates,
            ) as ScaleTrackProperties;
            onChange({ properties: mergedProps });
          }
          break;
        }
        case "fade": {
          if (override) {
            onChange({ properties: updates as FadeTrackProperties });
          } else {
            const mergedProps = deepMerge(
              track.properties,
              updates,
            ) as FadeTrackProperties;
            onChange({ properties: mergedProps });
          }
          break;
        }
        case "color": {
          if (override) {
            onChange({ properties: updates as ColorTrackProperties });
          } else {
            const mergedProps = deepMerge(
              track.properties,
              updates,
            ) as ColorTrackProperties;
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
  const { state } = useWorkspace();

  const bindButton = (fieldKey: string) => {
    // Prefer track-specific key when a track is selected
    const specific = `track.${track.identifier.id}.${fieldKey}`;
    return (
      <BindButton
        nodeId={animationNodeId}
        bindingKey={specific}
        objectId={selectedObjectId}
      />
    );
  };

  const isBound = (fieldKey: string): boolean => {
    const node = state.flow.nodes.find(
      (n) => n.data?.identifier?.id === animationNodeId,
    );
    if (!node) return false;

    const animationData = node.data as AnimationNodeData;
    const scoped = `track.${track.identifier.id}.${fieldKey}`;
    if (selectedObjectId) {
      const vbObj = (animationData.variableBindingsByObject?.[
        selectedObjectId
      ] ?? {}) as Record<string, { boundResultNodeId?: string }>;
      return !!(
        vbObj?.[scoped]?.boundResultNodeId ??
        vbObj?.[fieldKey]?.boundResultNodeId
      );
    }
    const vb = (animationData.variableBindings ?? {}) as Record<
      string,
      { boundResultNodeId?: string }
    >;
    return !!(
      vb?.[scoped]?.boundResultNodeId ?? vb?.[fieldKey]?.boundResultNodeId
    );
  };

  // Helper to get value for bound fields - blank if bound, normal value if not
  const getTrackFieldValue = function <T>(
    fieldKey: string,
    overrideValue: T | undefined,
    defaultValue: T,
  ): T | undefined {
    if (isBound(fieldKey)) return undefined; // Blank when bound
    return overrideValue ?? defaultValue;
  };

  // Type-safe property accessors for overrides
  const getOverrideProperty = function <T>(path: string): T | undefined {
    if (!override?.properties) return undefined;
    const props = override.properties;

    const parts = path.split(".");
    let current: unknown = props;

    for (const part of parts) {
      if (current && typeof current === "object" && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current as T | undefined;
  };

  // Helpers to compute per-field override/bound state for labels
  const isFieldOverridden = (key: string): boolean => {
    const p = override?.properties ?? {};
    switch (key) {
      case "move.from.x":
        return (p?.from as { x?: number })?.x !== undefined;
      case "move.from.y":
        return (p?.from as { y?: number })?.y !== undefined;
      case "move.to.x":
        return (p?.to as { x?: number })?.x !== undefined;
      case "move.to.y":
        return (p?.to as { y?: number })?.y !== undefined;
      case "rotate.from":
        return (p?.from as number) !== undefined;
      case "rotate.to":
        return (p?.to as number) !== undefined;
      case "scale.from":
        return (p?.from as number) !== undefined;
      case "scale.to":
        return (p?.to as number) !== undefined;
      case "fade.from":
        return (p?.from as number) !== undefined;
      case "fade.to":
        return (p?.to as number) !== undefined;
      case "color.property":
        return (p?.property as string) !== undefined;
      case "color.from":
        return (p?.from as string) !== undefined;
      case "color.to":
        return (p?.to as string) !== undefined;
      default:
        return false;
    }
  };
  const isFieldBound = (key: string): boolean => {
    const node = state.flow.nodes.find(
      (n) => n.data?.identifier?.id === animationNodeId,
    );
    if (!node) return false;

    const animationData = node.data as AnimationNodeData;
    const scopedKey = `track.${track.identifier.id}.${key}`;
    const vbObj = selectedObjectId
      ? (animationData.variableBindingsByObject?.[selectedObjectId] ?? {})
      : undefined;
    const vbGlobal = (animationData.variableBindings ?? {}) as Record<
      string,
      { boundResultNodeId?: string }
    >;
    const direct = !!(
      (vbObj as Record<string, { boundResultNodeId?: string }>)?.[scopedKey]
        ?.boundResultNodeId ??
      (vbObj as Record<string, { boundResultNodeId?: string }>)?.[key]
        ?.boundResultNodeId
    );
    if (direct) return true;
    // Inherited: only if not directly bound and not overridden at the field
    return !!(
      vbGlobal?.[scopedKey]?.boundResultNodeId ??
      vbGlobal?.[key]?.boundResultNodeId
    );
  };
  const labelWithOverride = (base: string) => {
    return base;
  };

  const FieldBadges = ({ keyName }: { keyName: string }) => (
    <div className="flex items-center gap-[var(--space-1)]">
      {isFieldOverridden(keyName) && (
        <OverrideBadge
          animationNodeId={animationNodeId}
          trackId={track.identifier.id}
          keyName={keyName}
          selectedObjectId={selectedObjectId}
        />
      )}
      {!isFieldOverridden(keyName) && (
        <BindingBadge
          nodeId={animationNodeId}
          keyName={`track.${track.identifier.id}.${keyName}`}
          objectId={selectedObjectId}
        />
      )}
    </div>
  );

  const leftBorderClass = (keyName: string) =>
    isFieldBound(keyName)
      ? "border-l-2 border-[var(--accent-secondary)]"
      : isFieldOverridden(keyName)
        ? "border-l-2 border-[var(--warning-600)]"
        : "";

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

  const currentError = editingName
    ? validateDisplayName(tempDisplayName, track.identifier.id)
    : null;

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Name editing (non-breaking): if identifier exists, allow editing */}
      {track.identifier && (
        <div className="space-y-[var(--space-2)] border-b border-[var(--border-primary)] pb-[var(--space-3)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-secondary)]">
              Transform Name
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {getTransformDisplayLabel(track.type)}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-[var(--space-1)]">
            {editingName ? (
              <>
                <input
                  className="glass-input w-full focus:ring-2 focus:ring-[var(--accent-primary)]"
                  value={tempDisplayName}
                  onChange={(e) => setTempDisplayName(e.target.value)}
                  placeholder="Enter transform name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !currentError) {
                      handleSaveDisplayName();
                    } else if (e.key === "Escape") {
                      handleCancelEdit();
                    }
                  }}
                  autoFocus
                />
                {currentError && (
                  <div className="text-xs text-[var(--danger-500)]">
                    {currentError}
                  </div>
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
                <span className="font-medium text-[var(--text-primary)]">
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
          value={override?.easing ?? track.easing}
          onChange={(easing) =>
            onChange({ easing: easing as AnimationTrack["easing"] })
          }
          options={easingOptions}
        />
        <div className="space-y-[var(--space-2)]">
          <label className="block text-xs text-[var(--text-tertiary)]">
            Track Duration
          </label>
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {track.duration.toFixed(1)}s
          </div>
        </div>
      </div>

      {isMoveTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
            Move Properties
          </div>

          {/* From Position - Two Column */}
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              From Position
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <div>
                <NumberField
                  label={labelWithOverride("X")}
                  value={getTrackFieldValue(
                    "move.from.x",
                    getOverrideProperty<number>("from.x"),
                    track.properties.from.x,
                  )}
                  onChange={(x) =>
                    updateProperties({
                      from: { x },
                    } as Partial<MoveTrackProperties>)
                  }
                  defaultValue={0}
                  bindAdornment={bindButton(`move.from.x`)}
                  disabled={isBound("move.from.x")}
                  inputClassName={leftBorderClass("move.from.x")}
                  className=""
                />
                {/* Badge - Only show when needed */}
                {(isFieldOverridden("move.from.x") ||
                  isFieldBound("move.from.x")) && (
                  <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                    <FieldBadges keyName="move.from.x" />
                  </div>
                )}
              </div>
              <div>
                <NumberField
                  label={labelWithOverride("Y")}
                  value={getTrackFieldValue(
                    "move.from.y",
                    getOverrideProperty<number>("from.y"),
                    track.properties.from.y,
                  )}
                  onChange={(y) =>
                    updateProperties({
                      from: { y },
                    } as Partial<MoveTrackProperties>)
                  }
                  defaultValue={0}
                  bindAdornment={bindButton(`move.from.y`)}
                  disabled={isBound("move.from.y")}
                  inputClassName={leftBorderClass("move.from.y")}
                />
                {/* Badge - Only show when needed */}
                {(isFieldOverridden("move.from.y") ||
                  isFieldBound("move.from.y")) && (
                  <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                    <FieldBadges keyName="move.from.y" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* To Position - Two Column */}
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              To Position
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <div>
                <NumberField
                  label={labelWithOverride("X")}
                  value={getTrackFieldValue(
                    "move.to.x",
                    getOverrideProperty<number>("to.x"),
                    track.properties.to.x,
                  )}
                  onChange={(x) =>
                    updateProperties({
                      to: { x },
                    } as Partial<MoveTrackProperties>)
                  }
                  defaultValue={100}
                  bindAdornment={bindButton(`move.to.x`)}
                  disabled={isBound("move.to.x")}
                  inputClassName={leftBorderClass("move.to.x")}
                />
                {/* Badge - Only show when needed */}
                {(isFieldOverridden("move.to.x") ||
                  isFieldBound("move.to.x")) && (
                  <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                    <FieldBadges keyName="move.to.x" />
                  </div>
                )}
              </div>
              <div>
                <NumberField
                  label={labelWithOverride("Y")}
                  value={getTrackFieldValue(
                    "move.to.y",
                    getOverrideProperty<number>("to.y"),
                    track.properties.to.y,
                  )}
                  onChange={(y) =>
                    updateProperties({
                      to: { y },
                    } as Partial<MoveTrackProperties>)
                  }
                  defaultValue={100}
                  bindAdornment={bindButton(`move.to.y`)}
                  disabled={isBound("move.to.y")}
                  inputClassName={leftBorderClass("move.to.y")}
                />
                {/* Badge - Only show when needed */}
                {(isFieldOverridden("move.to.y") ||
                  isFieldBound("move.to.y")) && (
                  <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                    <FieldBadges keyName="move.to.y" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isRotateTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
            Rotate Properties
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <div>
              <NumberField
                label={labelWithOverride("From")}
                value={getTrackFieldValue(
                  "rotate.from",
                  getOverrideProperty<number>("from"),
                  track.properties.from,
                )}
                onChange={(from) => updateProperties({ from })}
                step={0.1}
                defaultValue={0}
                bindAdornment={bindButton(`rotate.from`)}
                disabled={isBound("rotate.from")}
                inputClassName={leftBorderClass("rotate.from")}
              />
              {/* Badge - Only show when needed */}
              {(isFieldOverridden("rotate.from") ||
                isFieldBound("rotate.from")) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <FieldBadges keyName="rotate.from" />
                </div>
              )}
            </div>
            <div>
              <NumberField
                label={labelWithOverride("To")}
                value={getTrackFieldValue(
                  "rotate.to",
                  getOverrideProperty<number>("to"),
                  track.properties.to,
                )}
                onChange={(to) => updateProperties({ to })}
                step={0.1}
                defaultValue={1}
                bindAdornment={bindButton(`rotate.to`)}
                disabled={isBound("rotate.to")}
                inputClassName={leftBorderClass("rotate.to")}
              />
              {/* Badge - Only show when needed */}
              {(isFieldOverridden("rotate.to") ||
                isFieldBound("rotate.to")) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <FieldBadges keyName="rotate.to" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isScaleTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
            Scale Properties
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <div>
              <NumberField
                label={labelWithOverride("From")}
                value={getTrackFieldValue(
                  "scale.from",
                  getOverrideProperty<number>("from"),
                  track.properties.from,
                )}
                onChange={(from) => updateProperties({ from })}
                step={0.1}
                defaultValue={1}
                bindAdornment={bindButton(`scale.from`)}
                disabled={isBound("scale.from")}
                inputClassName={leftBorderClass("scale.from")}
              />
              {/* Badge - Only show when needed */}
              {(isFieldOverridden("scale.from") ||
                isFieldBound("scale.from")) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <FieldBadges keyName="scale.from" />
                </div>
              )}
            </div>
            <div>
              <NumberField
                label={labelWithOverride("To")}
                value={getTrackFieldValue(
                  "scale.to",
                  getOverrideProperty<number>("to"),
                  track.properties.to,
                )}
                onChange={(to) => updateProperties({ to })}
                step={0.1}
                defaultValue={2}
                bindAdornment={bindButton(`scale.to`)}
                disabled={isBound("scale.to")}
                inputClassName={leftBorderClass("scale.to")}
              />
              {/* Badge - Only show when needed */}
              {(isFieldOverridden("scale.to") || isFieldBound("scale.to")) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <FieldBadges keyName="scale.to" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isFadeTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
            Fade Properties
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <div>
              <NumberField
                label={labelWithOverride("From")}
                value={getTrackFieldValue(
                  "fade.from",
                  getOverrideProperty<number>("from"),
                  track.properties.from,
                )}
                onChange={(from) => updateProperties({ from })}
                step={0.05}
                defaultValue={1}
                bindAdornment={bindButton(`fade.from`)}
                disabled={isBound("fade.from")}
                inputClassName={leftBorderClass("fade.from")}
              />
              {/* Badge - Only show when needed */}
              {(isFieldOverridden("fade.from") ||
                isFieldBound("fade.from")) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <FieldBadges keyName="fade.from" />
                </div>
              )}
            </div>
            <div>
              <NumberField
                label={labelWithOverride("To")}
                value={getTrackFieldValue(
                  "fade.to",
                  getOverrideProperty<number>("to"),
                  track.properties.to,
                )}
                onChange={(to) => updateProperties({ to })}
                step={0.05}
                defaultValue={0}
                bindAdornment={bindButton(`fade.to`)}
                disabled={isBound("fade.to")}
                inputClassName={leftBorderClass("fade.to")}
              />
              {/* Badge - Only show when needed */}
              {(isFieldOverridden("fade.to") || isFieldBound("fade.to")) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <FieldBadges keyName="fade.to" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isColorTrack(track) && (
        <div className="space-y-[var(--space-3)]">
          <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
            Color Properties
          </div>

          {/* Property Selection - Full Width */}
          <SelectField
            label={labelWithOverride("Property")}
            value={
              getTrackFieldValue(
                "color.property",
                getOverrideProperty<string>("property"),
                track.properties.property,
              ) ?? track.properties.property
            }
            onChange={(property) =>
              updateProperties({ property: property as "fill" | "stroke" })
            }
            options={[
              { value: "fill", label: "Fill" },
              { value: "stroke", label: "Stroke" },
            ]}
          />

          {/* Color Fields - Two Column */}
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              Color Values
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <div>
                <ColorField
                  label={labelWithOverride("From")}
                  value={
                    getTrackFieldValue(
                      "color.from",
                      getOverrideProperty<string>("from"),
                      track.properties.from,
                    ) ?? track.properties.from
                  }
                  onChange={(from) => updateProperties({ from })}
                  bindAdornment={bindButton(`color.from`)}
                  disabled={isBound("color.from")}
                  inputClassName={leftBorderClass("color.from")}
                />
                {/* Badge - Only show when needed */}
                {(isFieldOverridden("color.from") ||
                  isFieldBound("color.from")) && (
                  <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                    <FieldBadges keyName="color.from" />
                  </div>
                )}
              </div>
              <div>
                <ColorField
                  label={labelWithOverride("To")}
                  value={
                    getTrackFieldValue(
                      "color.to",
                      getOverrideProperty<string>("to"),
                      track.properties.to,
                    ) ?? track.properties.to
                  }
                  onChange={(to) => updateProperties({ to })}
                  bindAdornment={bindButton(`color.to`)}
                  disabled={isBound("color.to")}
                  inputClassName={leftBorderClass("color.to")}
                />
                {/* Badge - Only show when needed */}
                {(isFieldOverridden("color.to") ||
                  isFieldBound("color.to")) && (
                  <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                    <FieldBadges keyName="color.to" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
