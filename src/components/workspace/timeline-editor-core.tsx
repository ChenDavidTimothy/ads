'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/ui/form-fields';
import { cn } from '@/lib/utils';
import { transformFactory } from '@/shared/registry/transforms';
import { generateTransformIdentifier } from '@/lib/defaults/transforms';
import { TransformTracker } from '@/lib/flow/transform-tracking';
import type {
  AnimationTrack,
  MoveTrackProperties,
  RotateTrackProperties,
  ScaleTrackProperties,
  FadeTrackProperties,
  ColorTrackProperties,
  SlideTrackProperties,
  AnimationNodeData,
} from '@/shared/types/nodes';
import type { PerObjectAssignments, TrackOverride } from '@/shared/properties/assignments';
import { useWorkspace } from './workspace-context';
import { BindButton } from '@/components/workspace/binding/bindings';
import { TimelineTrackRow, type TimelineDragState, type TimelineDragAction } from './timeline-track-row';
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

const DEFAULT_TIMELINE_WIDTH = 800;
const HANDLE_HITBOX_PX = 12; // Wide invisible hitbox (w-3)

function isPoint2D(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).x === 'number' &&
    typeof (value as Record<string, unknown>).y === 'number'
  );
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
  return !!v && isPoint2D(v.from) && isPoint2D(v.to);
}

function isFadeDefaults(value: unknown): value is FadeTrackProperties {
  const v = value as Partial<FadeTrackProperties>;
  return !!v && typeof v.from === 'number' && typeof v.to === 'number';
}

function isColorDefaults(value: unknown): value is ColorTrackProperties {
  const v = value as Partial<ColorTrackProperties>;
  return (
    !!v && typeof v.property === 'string' && typeof v.from === 'string' && typeof v.to === 'string'
  );
}

function isSlideDefaults(value: unknown): value is SlideTrackProperties {
  const v = value as Partial<SlideTrackProperties>;
  return !!v && typeof v.orientationDeg === 'number' && typeof v.velocity === 'number';
}

function getDefaultTrackProperties(trackType: AnimationTrack['type']): Record<string, unknown> {
  // Use the registry system to get default properties
  const defaults = transformFactory.getDefaultProperties(trackType);
  if (!defaults) {
    throw new Error(`Unknown track type: ${String(trackType)}`);
  }
  return defaults;
}

// Normalize legacy track property shapes to current schema
function normalizeTrack(t: AnimationTrack): AnimationTrack {
  if (t.type === 'scale') {
    const props = t.properties as unknown as {
      from?: number | { x?: number; y?: number };
      to?: number | { x?: number; y?: number };
    };
    const fromObj =
      typeof props.from === 'number'
        ? { x: props.from, y: props.from }
        : (props.from ?? { x: 1, y: 1 });
    const toObj =
      typeof props.to === 'number' ? { x: props.to, y: props.to } : (props.to ?? { x: 1, y: 1 });
    const from = {
      x: typeof fromObj.x === 'number' ? fromObj.x : 1,
      y: typeof fromObj.y === 'number' ? fromObj.y : 1,
    };
    const to = {
      x: typeof toObj.x === 'number' ? toObj.x : 1,
      y: typeof toObj.y === 'number' ? toObj.y : 1,
    };
    return { ...t, properties: { from, to } as unknown } as AnimationTrack;
  }
  return t;
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
  const [tracks, setTracks] = useState<AnimationTrack[]>(controlledTracks.map(normalizeTrack));
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<TimelineDragState | null>(null);
  const [localDragTracks, setLocalDragTracks] = useState<AnimationTrack[]>([]); // Local state for smooth dragging
  const { state } = useWorkspace();

  const timelineRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<TransformTracker>(new TransformTracker());
  const prevNodeIdRef = useRef<string>(animationNodeId);
  const trackColors = useMemo(() => transformFactory.getTrackColors(), []);
  const trackIcons = useMemo(() => transformFactory.getTrackIcons(), []);
  const [timelineWidth, setTimelineWidth] = useState<number>(DEFAULT_TIMELINE_WIDTH);

  // Initialize only when the animation node changes; preserve interaction state otherwise
  useEffect(() => {
    if (prevNodeIdRef.current !== animationNodeId) {
      setDuration(controlledDuration);
      setTracks(controlledTracks.map(normalizeTrack));
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

  // Measure timeline width responsively
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) setTimelineWidth(rect.width);
    };
    measure();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver((entries) => {
            for (const entry of entries) {
              const cr = entry.contentRect;
              if (cr.width > 0) setTimelineWidth(cr.width);
            }
          })
        : undefined;
    if (ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      if (ro) ro.disconnect();
    };
  }, []);

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
      setTracks(controlledTracks.map(normalizeTrack));
    }
  }, [controlledDuration, controlledTracks, onSelectedTrackChange]);

  const addTrack = useCallback(
    (type: AnimationTrack['type']) => {
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
          const props = isMoveDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
          newTrack = { ...baseTrack, type: 'move', properties: props };
          break;
        }
        case 'slide': {
          const props = isSlideDefaults(baseTrack.properties)
            ? baseTrack.properties
            : { orientationDeg: 0, velocity: 100 };
          newTrack = {
            ...baseTrack,
            type: 'slide',
            properties: props as SlideTrackProperties,
          } as unknown as AnimationTrack;
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
            : { from: { x: 1, y: 1 }, to: { x: 1.5, y: 1.5 } };
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
    [selectedTrackId, onChange]
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
    [onChange, tracks]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, trackId: string, action: TimelineDragAction) => {
      e.preventDefault();
      const track = tracks.find((t) => t.identifier.id === trackId);
      if (!track) return;
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {}
      setDragState({
        trackId,
        type: action,
        startX: e.clientX,
        startTime: track.startTime,
        startDuration: track.duration,
      });
      // Initialize local drag state for smooth updates
      setLocalDragTracks(tracks.map(normalizeTrack));
    },
    [tracks]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState || !localDragTracks.length) return;
      const track = localDragTracks.find((t) => t.identifier.id === dragState.trackId);
      if (!track) return;

      const deltaX = e.clientX - dragState.startX;
      const width = timelineWidth || DEFAULT_TIMELINE_WIDTH;
      const deltaTime = (deltaX / width) * duration;

      // Update local state immediately for smooth visual feedback
      setLocalDragTracks((prev) =>
        prev.map((t) => {
          if (t.identifier.id !== dragState.trackId) return t;

          switch (dragState.type) {
            case 'move': {
              const newStartTime = Math.max(
                0,
                Math.min(duration - t.duration, dragState.startTime + deltaTime)
              );
              return { ...t, startTime: newStartTime };
            }
            case 'resize-start': {
              const newStart = Math.max(
                0,
                Math.min(
                  dragState.startTime + dragState.startDuration - 0.1,
                  dragState.startTime + deltaTime
                )
              );
              const newDuration = dragState.startDuration - (newStart - dragState.startTime);
              return {
                ...t,
                startTime: newStart,
                duration: Math.max(0.1, newDuration),
              };
            }
            case 'resize-end': {
              const newDur = Math.max(
                0.1,
                Math.min(duration - dragState.startTime, dragState.startDuration + deltaTime)
              );
              return { ...t, duration: newDur };
            }
            default:
              return t;
          }
        })
      );
    },
    [dragState, localDragTracks, duration, timelineWidth]
  );

  const handlePointerUp = useCallback(() => {
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
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.removeEventListener('pointercancel', handlePointerUp);
      };
    }
  }, [dragState, handlePointerMove, handlePointerUp]);

  const selectedTrack = tracks.find((t) => t.identifier.id === selectedTrackId);

  // Notify parent of selection changes when requested
  useEffect(() => {
    if (typeof onSelectedTrackChange === 'function') {
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
              bindAdornment={<BindButton nodeId={animationNodeId} bindingKey="duration" />}
              disabled={(() => {
                const node = state.flow.nodes.find(
                  (n) => n.data?.identifier?.id === animationNodeId
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
            <span className="text-sm font-medium text-[var(--text-secondary)]">Add Track:</span>
            {transformFactory.getAllTransformTypes().map((type) => {
              const trackColors = transformFactory.getTrackColors();
              const trackIcons = transformFactory.getTrackIcons();
              return (
                <Button
                  key={type}
                  onClick={() => addTrack(type as AnimationTrack['type'])}
                  className={cn(
                    'border border-[var(--border-primary)] text-xs font-medium transition-all',
                    trackColors[type] ??
                      'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)]'
                  )}
                  size="sm"
                >
                  {trackIcons[type] ?? '●'} {type}
                </Button>
              );
            })}
          </div>
        </div>

        <div
          ref={timelineRef}
          className="shadow-glass relative w-full rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-4)]"
        >
          <div className="relative mb-[var(--space-4)] h-6">
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: `${(i / duration) * 100}%` }}
              >
                <div className="h-4 w-px bg-[var(--border-secondary)]" />
                <span className="mt-1 text-xs text-[var(--text-tertiary)]">{i}s</span>
              </div>
            ))}
          </div>

          <div
            className="timeline-tracks-container scrollbar-elegant overflow-y-auto pr-[var(--space-2)]"
            style={{ maxHeight: '40vh' }}
          >
            <div className="space-y-[var(--space-3)]">
              {displayTracks.map((track) => {
                const trackColorClass =
                  trackColors[track.type] ?? 'bg-[var(--surface-interactive)]';
                const trackIcon = trackIcons[track.type] ?? '●';
                return (
                  <TimelineTrackRow
                    key={track.identifier.id}
                    track={track}
                    duration={duration}
                    timelineWidth={timelineWidth}
                    fallbackTimelineWidth={DEFAULT_TIMELINE_WIDTH}
                    handleHitboxPx={HANDLE_HITBOX_PX}
                    dragState={dragState}
                    isSelected={selectedTrackId === track.identifier.id}
                    trackColorClass={trackColorClass}
                    trackIcon={trackIcon}
                    onSelect={setSelectedTrackId}
                    onDelete={deleteTrack}
                    onPointerDown={handlePointerDown}
                  />
                );
              })}

            </div>
          </div>

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
  );
}

export { TrackProperties } from './timeline-track-properties';
