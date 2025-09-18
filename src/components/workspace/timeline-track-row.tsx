import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AnimationTrack } from '@/shared/types/nodes';
import type { PointerEvent, ReactNode } from 'react';

export type TimelineDragAction = 'move' | 'resize-start' | 'resize-end';

export interface TimelineDragState {
  trackId: string;
  type: TimelineDragAction;
  startX: number;
  startTime: number;
  startDuration: number;
}

interface TimelineTrackRowProps {
  track: AnimationTrack;
  duration: number;
  timelineWidth: number;
  fallbackTimelineWidth: number;
  handleHitboxPx: number;
  dragState: TimelineDragState | null;
  isSelected: boolean;
  trackColorClass: string;
  trackIcon: ReactNode;
  onSelect: (trackId: string) => void;
  onDelete: (trackId: string) => void;
  onPointerDown: (event: PointerEvent, trackId: string, action: TimelineDragAction) => void;
}

export function TimelineTrackRow({
  track,
  duration,
  timelineWidth,
  fallbackTimelineWidth,
  handleHitboxPx,
  dragState,
  isSelected,
  trackColorClass,
  trackIcon,
  onSelect,
  onDelete,
  onPointerDown,
}: TimelineTrackRowProps) {
  const widthBase = timelineWidth || fallbackTimelineWidth;
  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="w-16 text-sm font-medium text-[var(--text-primary)]">
            {trackIcon} {track.type}
          </span>
          {isSelected && <Badge variant="result">SELECTED</Badge>}
        </div>
        <Button
          onClick={() => onDelete(track.identifier.id)}
          variant="danger"
          size="sm"
          className="text-xs"
        >
          Delete
        </Button>
      </div>

      <div className="glass-panel relative h-8 rounded-[var(--radius-sm)] border border-[var(--border-secondary)] bg-[var(--surface-2)]">
        <div
          className={cn(
            'absolute h-6 cursor-move touch-none rounded-[var(--radius-sm)] border border-transparent text-[var(--text-primary)] select-none',
            trackColorClass,
            isSelected
              ? 'border-[var(--accent-primary)] shadow-[0_0_20px_var(--purple-shadow-medium),0_4px_12px_var(--purple-shadow-subtle)]'
              : 'hover:border-[var(--border-accent)] hover:brightness-110',
            dragState?.trackId === track.identifier.id ? 'opacity-80' : ''
          )}
          style={{
            left: `${(track.startTime / duration) * 100}%`,
            width: `${(track.duration / duration) * 100}%`,
            top: '1px',
          }}
          onPointerDown={(event) => onPointerDown(event, track.identifier.id, 'move')}
          onClick={() => onSelect(track.identifier.id)}
        >
          <div className="flex h-full items-center justify-between px-[var(--space-2)]">
            <span className="truncate text-xs font-medium">{track.identifier.displayName}</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {track.duration.toFixed(1)}s
            </span>
          </div>
        </div>

        <div
          className="absolute z-10 h-6 w-3 cursor-w-resize touch-none select-none"
          style={{
            left: `${(track.startTime / duration) * 100}%`,
            top: '1px',
          }}
          onPointerDown={(event) => onPointerDown(event, track.identifier.id, 'resize-start')}
        >
          <div className="absolute inset-y-0 left-0 w-1 rounded-l-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-1)] transition-colors hover:border-[var(--accent-primary)] hover:bg-[var(--surface-interactive)]" />
        </div>
        <div
          className="absolute z-10 h-6 w-3 cursor-e-resize touch-none select-none"
          style={{
            left: `${((track.startTime + track.duration) / duration) * 100 - (handleHitboxPx / widthBase) * 100}%`,
            top: '1px',
          }}
          onPointerDown={(event) => onPointerDown(event, track.identifier.id, 'resize-end')}
        >
          <div className="absolute inset-y-0 right-0 w-1 rounded-r-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-1)] transition-colors hover:border-[var(--accent-primary)] hover:bg-[var(--surface-interactive)]" />
        </div>
      </div>

      <div className="mt-1 text-xs text-[var(--text-tertiary)]">
        {track.startTime.toFixed(1)}s - {(track.startTime + track.duration).toFixed(1)}s
      </div>
    </div>
  );
}
