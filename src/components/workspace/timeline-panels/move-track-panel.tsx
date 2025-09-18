import { NumberField } from '@/components/ui/form-fields';
import type { AnimationTrack, MoveTrackProperties } from '@/shared/types/nodes';
import type { TimelineFieldHelpers } from '../timeline-binding-utils';

interface MoveTrackPanelProps {
  track: Extract<AnimationTrack, { type: 'move' }>;
  onChange: (updates: Partial<MoveTrackProperties>) => void;
  helpers: TimelineFieldHelpers;
  labelWithOverride: (label: string) => string;
}

export function MoveTrackPanel({ track, onChange, helpers, labelWithOverride }: MoveTrackPanelProps) {
  const { bindAdornment, getFieldValue, getOverrideValue, isFieldBound, isFieldOverridden, FieldBadges, leftBorderClass } = helpers;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
        Move Properties
      </div>

      <div className="space-y-[var(--space-2)]">
        <div className="text-xs font-medium text-[var(--text-secondary)]">From Position</div>
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label={labelWithOverride('X')}
              value={getFieldValue(
                'move.from.x',
                getOverrideValue<number>('from.x'),
                track.properties.from.x
              )}
              onChange={(x) =>
                onChange({
                  from: { x },
                } as Partial<MoveTrackProperties>)
              }
              defaultValue={0}
              bindAdornment={bindAdornment('move.from.x')}
              disabled={isFieldBound('move.from.x')}
              inputClassName={leftBorderClass('move.from.x')}
            />
            {(isFieldOverridden('move.from.x') || isFieldBound('move.from.x')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="move.from.x" />
              </div>
            )}
          </div>
          <div>
            <NumberField
              label={labelWithOverride('Y')}
              value={getFieldValue(
                'move.from.y',
                getOverrideValue<number>('from.y'),
                track.properties.from.y
              )}
              onChange={(y) =>
                onChange({
                  from: { y },
                } as Partial<MoveTrackProperties>)
              }
              defaultValue={0}
              bindAdornment={bindAdornment('move.from.y')}
              disabled={isFieldBound('move.from.y')}
              inputClassName={leftBorderClass('move.from.y')}
            />
            {(isFieldOverridden('move.from.y') || isFieldBound('move.from.y')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="move.from.y" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-[var(--space-2)]">
        <div className="text-xs font-medium text-[var(--text-secondary)]">To Position</div>
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label={labelWithOverride('X')}
              value={getFieldValue(
                'move.to.x',
                getOverrideValue<number>('to.x'),
                track.properties.to.x
              )}
              onChange={(x) =>
                onChange({
                  to: { x },
                } as Partial<MoveTrackProperties>)
              }
              defaultValue={100}
              bindAdornment={bindAdornment('move.to.x')}
              disabled={isFieldBound('move.to.x')}
              inputClassName={leftBorderClass('move.to.x')}
            />
            {(isFieldOverridden('move.to.x') || isFieldBound('move.to.x')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="move.to.x" />
              </div>
            )}
          </div>
          <div>
            <NumberField
              label={labelWithOverride('Y')}
              value={getFieldValue(
                'move.to.y',
                getOverrideValue<number>('to.y'),
                track.properties.to.y
              )}
              onChange={(y) =>
                onChange({
                  to: { y },
                } as Partial<MoveTrackProperties>)
              }
              defaultValue={100}
              bindAdornment={bindAdornment('move.to.y')}
              disabled={isFieldBound('move.to.y')}
              inputClassName={leftBorderClass('move.to.y')}
            />
            {(isFieldOverridden('move.to.y') || isFieldBound('move.to.y')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="move.to.y" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
