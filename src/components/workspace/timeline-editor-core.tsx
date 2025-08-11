"use client";

import { useState, useCallback, useEffect } from "react";
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
        easing: definition?.metadata?.defaultEasing ?? "easeInOut",
        properties: getDefaultTrackProperties(type),
      };

      let newTrack: AnimationTrack;
      switch (type) {
        case 'move':
          newTrack = { ...baseTrack, type, properties: baseTrack.properties as unknown as MoveTrackProperties };
          break;
        case 'rotate':
          newTrack = { ...baseTrack, type, properties: baseTrack.properties as unknown as RotateTrackProperties };
          break;
        case 'scale':
          newTrack = { ...baseTrack, type, properties: baseTrack.properties as unknown as ScaleTrackProperties };
          break;
        case 'fade':
          newTrack = { ...baseTrack, type, properties: baseTrack.properties as unknown as FadeTrackProperties };
          break;
        case 'color':
          newTrack = { ...baseTrack, type, properties: baseTrack.properties as unknown as ColorTrackProperties };
          break;
        default:
          throw new Error(`Unknown track type: ${String(type)}`);
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
        return { ...track, ...updates };
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
            />
            <Button onClick={() => onSave(duration, tracks)}>Save</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        </div>

        <div className="flex gap-4 mb-4">
            <Button variant="ghost" onClick={() => addTrack("move")}>
              Add Move Track
            </Button>
            <Button variant="ghost" onClick={() => addTrack("rotate")}>
              Add Rotate Track
            </Button>
            <Button variant="ghost" onClick={() => addTrack("scale")}>
              Add Scale Track
            </Button>
            <Button variant="ghost" onClick={() => addTrack("fade")}>
              Add Fade Track
            </Button>
            <Button variant="ghost" onClick={() => addTrack("color")}>
              Add Color Track
            </Button>
        </div>

        <div className="space-y-2">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={cn(
                "flex items-center gap-2 p-2 border rounded cursor-pointer",
                selectedTrackId === track.id ? "border-blue-500 bg-blue-50" : "border-gray-300"
              )}
              onClick={() => setSelectedTrackId(track.id)}
            >
              <div className="flex-1">
                <div className="text-sm font-medium">{track.type}</div>
                <div className="text-xs text-gray-500">
                  {track.startTime.toFixed(1)}s - {(track.startTime + track.duration).toFixed(1)}s ({track.duration.toFixed(1)}s)
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTrack(track.id);
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </div>

      {selectedTrack && (
        <div className="w-80 p-4 border-l bg-gray-50">
          <TrackProperties track={selectedTrack} onChange={(updates) => updateTrack(selectedTrack.id, updates)} />
        </div>
      )}
    </div>
  );
}

interface TrackPropertiesProps {
  track: AnimationTrack;
  onChange: (updates: Partial<AnimationTrack>) => void;
}

function TrackProperties({ track, onChange }: TrackPropertiesProps) {
  const updateProperties = (properties: Record<string, unknown>) => {
    onChange({ properties: { ...track.properties, ...properties } } as Partial<AnimationTrack>);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="text-sm font-medium text-white">General Properties</div>
        <NumberField
          label="Start Time (seconds)"
          value={track.startTime}
          onChange={(startTime) => onChange({ startTime })}
          min={0}
          step={0.1}
        />
        <NumberField
          label="Duration (seconds)"
          value={track.duration}
          onChange={(duration) => onChange({ duration })}
          min={0.1}
          step={0.1}
        />
        <SelectField
          label="Easing"
          value={track.easing}
          onChange={(easing) => onChange({ easing: easing as 'linear' | 'easeInOut' | 'easeIn' | 'easeOut' })}
          options={[
            { value: "linear", label: "Linear" },
            { value: "easeInOut", label: "Ease In/Out" },
            { value: "easeIn", label: "Ease In" },
            { value: "easeOut", label: "Ease Out" },
          ]}
        />
      </div>

      {isMoveTrack(track) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Move Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="From X"
              value={track.properties.from.x}
              onChange={(x) => updateProperties({ from: { ...track.properties.from, x } })}
              step={1}
            />
            <NumberField
              label="From Y"
              value={track.properties.from.y}
              onChange={(y) => updateProperties({ from: { ...track.properties.from, y } })}
              step={1}
            />
            <NumberField
              label="To X"
              value={track.properties.to.x}
              onChange={(x) => updateProperties({ to: { ...track.properties.to, x } })}
              step={1}
            />
            <NumberField
              label="To Y"
              value={track.properties.to.y}
              onChange={(y) => updateProperties({ to: { ...track.properties.to, y } })}
              step={1}
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


