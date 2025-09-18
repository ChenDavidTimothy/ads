import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/form-fields';
import { getTransformDisplayLabel } from '@/lib/defaults/transforms';
import type {
  AnimationTrack,
  ColorTrackProperties,
  FadeTrackProperties,
  MoveTrackProperties,
  RotateTrackProperties,
  ScaleTrackProperties,
  SlideTrackProperties,
} from '@/shared/types/nodes';
import {
  isColorTrack,
  isFadeTrack,
  isMoveTrack,
  isRotateTrack,
  isScaleTrack,
  isSlideTrack,
} from '@/shared/types/nodes';
import type { TrackOverride } from '@/shared/properties/assignments';
import { deepMerge } from '@/shared/utils/object-path';
import { useTimelineFieldHelpers } from './timeline-binding-utils';
import {
  ColorTrackPanel,
  FadeTrackPanel,
  MoveTrackPanel,
  RotateTrackPanel,
  ScaleTrackPanel,
  SlideTrackPanel,
} from './timeline-panels';

type TrackPropertyUnion =
  | MoveTrackProperties
  | SlideTrackProperties
  | RotateTrackProperties
  | ScaleTrackProperties
  | FadeTrackProperties
  | ColorTrackProperties;

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
  const [tempDisplayName, setTempDisplayName] = useState(track.identifier.displayName);

  const easingOptions = [
    { value: 'linear', label: 'Linear' },
    { value: 'easeInOut', label: 'Ease In Out' },
    { value: 'easeIn', label: 'Ease In' },
    { value: 'easeOut', label: 'Ease Out' },
  ];

  const helpers = useTimelineFieldHelpers({
    animationNodeId,
    trackIdentifierId: track.identifier.id,
    override,
    selectedObjectId,
  });

  const labelWithOverride = useCallback((base: string) => base, []);

  const commitProperties = useCallback(
    <T extends TrackPropertyUnion>(updates: Partial<T>, base: T) => {
      if (selectedObjectId) {
        onChange({ properties: updates as T } as Partial<AnimationTrack>);
        return;
      }
      const mergedProps = deepMerge(base, updates);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      onChange({ properties: mergedProps as T } as Partial<AnimationTrack>);
    },
    [onChange, selectedObjectId]
  );

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
      {track.identifier && (
        <div className="space-y-[var(--space-2)] border-b border-[var(--border-primary)] pb-[var(--space-3)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-secondary)]">Transform Name</div>
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
                    if (e.key === 'Enter' && !currentError) {
                      handleSaveDisplayName();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  autoFocus
                />
                {currentError && (
                  <div className="text-xs text-[var(--danger-500)]">{currentError}</div>
                )}
                <div className="flex gap-[var(--space-2)]">
                  <Button onClick={handleSaveDisplayName} disabled={!!currentError} variant="primary" size="sm">
                    Save
                  </Button>
                  <Button onClick={handleCancelEdit} variant="secondary" size="sm">
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--text-primary)]">{track.identifier.displayName}</span>
                <Button onClick={() => setEditingName(true)} variant="minimal" size="sm">
                  Edit
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-[var(--space-3)]">
        <SelectField
          label={labelWithOverride('Easing')}
          value={override?.easing ?? track.easing}
          onChange={(easing) => onChange({ easing: easing as AnimationTrack['easing'] })}
          options={easingOptions}
        />
        <div className="space-y-[var(--space-2)]">
          <label className="block text-xs text-[var(--text-tertiary)]">Track Duration</label>
          <div className="text-sm font-medium text-[var(--text-primary)]">{track.duration.toFixed(1)}s</div>
        </div>
      </div>

      {isMoveTrack(track) && (
        <MoveTrackPanel
          track={track}
          onChange={(updates) =>
            commitProperties<MoveTrackProperties>(updates, track.properties)
          }
          helpers={helpers}
          labelWithOverride={labelWithOverride}
        />
      )}

      {isSlideTrack(track) && (
        <SlideTrackPanel
          track={track}
          onChange={(updates) =>
            commitProperties<SlideTrackProperties>(updates, track.properties)
          }
          helpers={helpers}
          labelWithOverride={labelWithOverride}
        />
      )}

      {isRotateTrack(track) && (
        <RotateTrackPanel
          track={track}
          onChange={(updates) =>
            commitProperties<RotateTrackProperties>(updates, track.properties)
          }
          helpers={helpers}
          labelWithOverride={labelWithOverride}
        />
      )}

      {isScaleTrack(track) && (
        <ScaleTrackPanel
          track={track}
          onChange={(updates) =>
            commitProperties<ScaleTrackProperties>(updates, track.properties)
          }
          helpers={helpers}
          labelWithOverride={labelWithOverride}
        />
      )}

      {isFadeTrack(track) && (
        <FadeTrackPanel
          track={track}
          onChange={(updates) =>
            commitProperties<FadeTrackProperties>(updates, track.properties)
          }
          helpers={helpers}
          labelWithOverride={labelWithOverride}
        />
      )}

      {isColorTrack(track) && (
        <ColorTrackPanel
          track={track}
          onChange={(updates) =>
            commitProperties<ColorTrackProperties>(updates, track.properties)
          }
          helpers={helpers}
          labelWithOverride={labelWithOverride}
        />
      )}
    </div>
  );
}



