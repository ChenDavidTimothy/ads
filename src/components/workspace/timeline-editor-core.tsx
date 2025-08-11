"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { NumberField, SelectField, ColorField } from "@/components/ui/form-fields";
import { cn } from "@/lib/utils";
import { transformFactory } from '@/shared/registry/transforms';
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
  initialDuration: number;
  initialTracks: AnimationTrack[];
  onSave: (duration: number, tracks: AnimationTrack[]) => void;
  onCancel: () => void;
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

export function TimelineEditorCore({ initialDuration, initialTracks, onSave, onCancel }: TimelineEditorCoreProps) {
  const [duration, setDuration] = useState(initialDuration);
  const [tracks, setTracks] = useState<AnimationTrack[]>(initialTracks);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDuration(initialDuration);
    setTracks(initialTracks);
    setSelectedTrackId(null);
    setDragState(null);
  }, [initialDuration, initialTracks]);

  const addTrack = useCallback(
    (type: AnimationTrack["type"]) => {
      const id = `${type}-${Date.now()}`;
      const definition = transformFactory.getTransformDefinition(type);
      const baseTrack = {
        id,
        startTime: 0,
        duration: Math.min(2, duration),
        easing: definition?.metadata?.defaultEasing ?? 'easeInOut',
        properties: getDefaultTrackProperties(type),
      };

      let newTrack: AnimationTrack;
      switch (type) {
        case 'move': {
          const props = isMoveDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
          newTrack = { ...baseTrack, type: 'move', properties: props };
          break;
        }
        case 'rotate': {
          const props = isRotateDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: 0, to: 1 };
          newTrack = { ...baseTrack, type: 'rotate', properties: props };
          break;
        }
        case 'scale': {
          const props = isScaleDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: 1, to: 1.5 };
          newTrack = { ...baseTrack, type: 'scale', properties: props };
          break;
        }
        case 'fade': {
          const props = isFadeDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: 1, to: 0.5 };
          newTrack = { ...baseTrack, type: 'fade', properties: props };
          break;
        }
        case 'color': {
          let props: ColorTrackProperties;
          if (isColorDefaults(baseTrack.properties)) {
            props = baseTrack.properties;
          } else {
            props = { from: '#ff0000', to: '#00ff00', property: 'fill' };
          }
          newTrack = { ...baseTrack, type: 'color', properties: props };
          break;
        }
      }
      setTracks((prev) => [...prev, newTrack]);
    },
    [duration],
  );

  const updateTrack = useCallback(<T extends AnimationTrack>(trackId: string, updates: Partial<T>) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        if (track.type !== (updates.type ?? track.type)) return track;
        return { ...track, ...updates } as AnimationTrack;
      }),
    );
  }, []);

  const deleteTrack = useCallback(
    (trackId: string) => {
      setTracks((prev) => prev.filter((track) => track.id !== trackId));
      if (selectedTrackId === trackId) {
        setSelectedTrackId(null);
      }
    },
    [selectedTrackId],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, trackId: string, type: DragState["type"]) => {
      e.preventDefault();
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      setDragState({ trackId, type, startX: e.clientX, startTime: track.startTime, startDuration: track.duration });
    },
    [tracks],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;
      const track = tracks.find((t) => t.id === dragState.trackId);
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

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <NumberField
              label="Duration (seconds)"
              value={duration}
              onChange={setDuration}
              min={0.1}
              step={0.1}
              defaultValue={3}
              className="w-32"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onSave(duration, tracks)} variant="success" size="sm">
              Save
            </Button>
            <Button onClick={onCancel} variant="secondary" size="sm">
              Cancel
            </Button>
          </div>
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
              <div key={track.id} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white w-16">
                      {(() => {
                        const trackIcons = transformFactory.getTrackIcons();
                        return trackIcons[track.type] ?? "●";
                      })()} {track.type}
                    </span>
                    {selectedTrackId === track.id && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">SELECTED</span>
                    )}
                  </div>
                  <Button onClick={() => deleteTrack(track.id)} variant="danger" size="sm" className="text-xs">
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
                      selectedTrackId === track.id ? "ring-2 ring-blue-400 shadow-lg" : "hover:brightness-110",
                      dragState?.trackId === track.id ? "opacity-80" : "",
                    )}
                    style={{ left: `${(track.startTime / duration) * 100}%`, width: `${(track.duration / duration) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.id, "move")}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    <div className="flex items-center justify-between h-full px-2">
                      <span className="text-xs font-medium truncate">{track.type}</span>
                      <span className="text-xs text-white/80">{track.duration.toFixed(1)}s</span>
                    </div>
                  </div>

                  <div
                    className="absolute w-3 h-6 cursor-w-resize bg-white/30 hover:bg-white/50 rounded-l z-10"
                    style={{ left: `${(track.startTime / duration) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.id, "resize-start")}
                  />
                  <div
                    className="absolute w-3 h-6 cursor-e-resize bg-white/30 hover:bg-white/50 rounded-r z-10"
                    style={{ left: `${((track.startTime + track.duration) / duration) * 100 - (12 / TIMELINE_WIDTH) * 100}%`, top: "1px" }}
                    onMouseDown={(e) => handleMouseDown(e, track.id, "resize-end")}
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
          <TrackProperties track={selectedTrack} onChange={(updates) => updateTrack(selectedTrack.id, updates)} />
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
}

function TrackProperties({ track, onChange }: TrackPropertiesProps) {
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


