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

interface TimelineEditorCoreProps {
  animationNodeId: string;
  duration: number;
  tracks: AnimationTrack[];
  onChange: (updates: Partial<{ duration: number; tracks: AnimationTrack[] }>) => void;
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

export function TimelineEditorCore({ animationNodeId, duration: controlledDuration, tracks: controlledTracks, onChange }: TimelineEditorCoreProps) {
  const [duration, setDuration] = useState(controlledDuration);
  const [tracks, setTracks] = useState<AnimationTrack[]>(controlledTracks);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

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
    setDuration(newDuration);
    onChange({ duration: newDuration });
  }, [onChange]);

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
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <NumberField
              label="Duration (seconds)"
              value={duration}
              onChange={handleDurationImmediate}
              min={0.1}
              step={0.1}
              defaultValue={3}
              className="w-32"
            />
          </div>
          {/* Save/Cancel removed: unified manual save handled at workspace level */}
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-300">Add Track:</span>
            {transformFactory.getAllTransformTypes().map((type) => {
              const trackColors = transformFactory.getTrackColors();
              const trackIcons = transformFactory.getTrackIcons();
              return (
                <Button 
                  key={type} 
                  onClick={() => addTrack(type as AnimationTrack["type"])} 
                  className={cn("text-xs", trackColors[type] ?? "bg-gray-600")} 
                  size="sm"
                >
                  {trackIcons[type] ?? "●"} {type}
                </Button>
              );
            })}
          </div>
        </div>

        <div ref={timelineRef} className="relative bg-gray-900 rounded-lg p-4" style={{ width: `${TIMELINE_WIDTH}px` }}>
          <div className="relative h-6 mb-4">
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div key={i} className="absolute flex flex-col items-center" style={{ left: `${(i / duration) * 100}%` }}>
                <div className="w-px h-4 bg-gray-500" />
                <span className="text-xs text-gray-400 mt-1">{i}s</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {tracks.map((track) => (
              <div key={track.identifier.id} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white w-16">
                      {(() => {
                        const trackIcons = transformFactory.getTrackIcons();
                        return trackIcons[track.type] ?? "●";
                      })()} {track.type}
                    </span>
                    {selectedTrackId === track.identifier.id && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">SELECTED</span>
                    )}
                  </div>
                  <Button onClick={() => deleteTrack(track.identifier.id)} variant="danger" size="sm" className="text-xs">
                    Delete
                  </Button>
                </div>

                <div className="relative h-8 bg-gray-700 rounded">
                  <div
                    className={cn(
                      "absolute h-6 rounded cursor-move transition-all text-white",
                      (() => {
                        const trackColors = transformFactory.getTrackColors();
                        return trackColors[track.type] ?? "bg-gray-600";
                      })(),
                       selectedTrackId === track.identifier.id ? "ring-2 ring-blue-400 shadow-lg" : "hover:brightness-110",
                       dragState?.trackId === track.identifier.id ? "opacity-80" : "",
                    )}
                    style={{ left: `${(track.startTime / duration) * 100}%`, width: `${(track.duration / duration) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.identifier.id, "move")}
                    onClick={() => setSelectedTrackId(track.identifier.id)}
                  >
                   <div className="flex items-center justify-between h-full px-2">
                      <span className="text-xs font-medium truncate">{track.identifier.displayName}</span>
                      <span className="text-xs text-white/80">{track.duration.toFixed(1)}s</span>
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

                <div className="text-xs text-gray-400 mt-1">
                  {track.startTime.toFixed(1)}s - {(track.startTime + track.duration).toFixed(1)}s
                </div>
              </div>
            ))}
          </div>

          {tracks.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-lg mb-2">No animation tracks</div>
              <div className="text-sm mb-4">Click the colored buttons above to add animation tracks</div>
            </div>
          )}
        </div>
      </div>

      <div className="w-80 border-l border-gray-600 p-4 bg-gray-850">
        <h3 className="text-lg font-semibold text-white mb-4">Properties</h3>
        {selectedTrack ? (
          <TrackProperties 
            track={selectedTrack} 
            onChange={(updates) => updateTrack(selectedTrack.identifier.id, updates)} 
            allTracks={tracks}
            onDisplayNameChange={updateTransformDisplayName}
            validateDisplayName={validateTransformDisplayName}
          />
        ) : (
          <div className="text-gray-400 text-sm">Click a track to select and edit its properties</div>
        )}
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
}

function TrackProperties({ track, onChange, allTracks, onDisplayNameChange, validateDisplayName }: TrackPropertiesProps) {
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
          const merged: MoveTrackProperties = { ...track.properties, ...(updates as Partial<MoveTrackProperties>) };
          onChange({ properties: merged });
          break;
        }
        case "rotate": {
          const merged: RotateTrackProperties = { ...track.properties, ...(updates as Partial<RotateTrackProperties>) };
          onChange({ properties: merged });
          break;
        }
        case "scale": {
          const merged: ScaleTrackProperties = { ...track.properties, ...(updates as Partial<ScaleTrackProperties>) };
          onChange({ properties: merged });
          break;
        }
        case "fade": {
          const merged: FadeTrackProperties = { ...track.properties, ...(updates as Partial<FadeTrackProperties>) };
          onChange({ properties: merged });
          break;
        }
        case "color": {
          const merged: ColorTrackProperties = { ...track.properties, ...(updates as Partial<ColorTrackProperties>) };
          onChange({ properties: merged });
          break;
        }
        default:
          break;
      }
    },
    [track.type, track.properties, onChange],
  );

  return (
    <div className="space-y-4">
      {/* Name editing (non-breaking): if identifier exists, allow editing */}
      {track.identifier && (
        <div className="space-y-2 pb-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">Transform Name</div>
            <div className="text-xs text-gray-400">{getTransformDisplayLabel(track.type)} • #{track.identifier.sequence}</div>
          </div>
          <div className="flex flex-col gap-1 items-stretch">
            <input
              className="bg-gray-800 text-white text-sm px-2 py-1 rounded w-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              return err ? <span className="text-xs text-red-400">{err}</span> : null;
            })()}
          </div>
        </div>
      )}
      <SelectField
        label="Easing"
        value={track.easing}
        onChange={(easing) => onChange({ easing: easing as AnimationTrack["easing"] })}
        options={easingOptions}
      />

      {isMoveTrack(track) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Move Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="From X"
              value={track.properties.from.x}
              onChange={(x) => updateProperties({ from: { ...track.properties.from, x } })}
              defaultValue={0}
            />
            <NumberField
              label="From Y"
              value={track.properties.from.y}
              onChange={(y) => updateProperties({ from: { ...track.properties.from, y } })}
              defaultValue={0}
            />
            <NumberField
              label="To X"
              value={track.properties.to.x}
              onChange={(x) => updateProperties({ to: { ...track.properties.to, x } })}
              defaultValue={100}
            />
            <NumberField
              label="To Y"
              value={track.properties.to.y}
              onChange={(y) => updateProperties({ to: { ...track.properties.to, y } })}
              defaultValue={100}
            />
          </div>
        </div>
      )}

      {isRotateTrack(track) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Rotate Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="From Rotation"
              value={track.properties.from}
              onChange={(from) => updateProperties({ from })}
              step={0.1}
              defaultValue={0}
            />
            <NumberField
              label="To Rotation"
              value={track.properties.to}
              onChange={(to) => updateProperties({ to })}
              step={0.1}
              defaultValue={1}
            />
          </div>
        </div>
      )}

      {isScaleTrack(track) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Scale Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="From"
              value={track.properties.from}
              onChange={(from) => updateProperties({ from })}
              step={0.1}
              min={0}
              defaultValue={1}
            />
            <NumberField
              label="To"
              value={track.properties.to}
              onChange={(to) => updateProperties({ to })}
              step={0.1}
              min={0}
              defaultValue={1.5}
            />
          </div>
        </div>
      )}

      {isFadeTrack(track) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Fade Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="From Opacity"
              value={track.properties.from}
              onChange={(from) => updateProperties({ from })}
              step={0.1}
              min={0}
              max={1}
              defaultValue={1}
            />
            <NumberField
              label="To Opacity"
              value={track.properties.to}
              onChange={(to) => updateProperties({ to })}
              step={0.1}
              min={0}
              max={1}
              defaultValue={0.5}
            />
          </div>
        </div>
      )}

      {isColorTrack(track) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Color Properties</div>
          <SelectField
            label="Property"
            value={track.properties.property}
            onChange={(property) => updateProperties({ property: property as "fill" | "stroke" })}
            options={[
              { value: "fill", label: "Fill" },
              { value: "stroke", label: "Stroke" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="From Color" value={track.properties.from} onChange={(from) => updateProperties({ from })} />
            <ColorField label="To Color" value={track.properties.to} onChange={(to) => updateProperties({ to })} />
          </div>
        </div>
      )}
    </div>
  );
}


