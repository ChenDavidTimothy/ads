import { NumberField } from '@/components/ui/form-fields';
import type { AnimationTrack, ScaleTrackProperties } from '@/shared/types/nodes';
import type { TimelineFieldHelpers } from '../timeline-binding-utils';

interface ScaleTrackPanelProps {
  track: Extract<AnimationTrack, { type: 'scale' }>;
  onChange: (updates: Partial<ScaleTrackProperties>) => void;
  helpers: TimelineFieldHelpers;
  labelWithOverride: (label: string) => string;
}

export function ScaleTrackPanel({ track, onChange, helpers, labelWithOverride }: ScaleTrackPanelProps) {
  const { bindAdornment, getFieldValue, getOverrideValue, isFieldBound, isFieldOverridden, FieldBadges, leftBorderClass } = helpers;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
        Scale Properties
      </div>
      <div className="space-y-[var(--space-2)]">
        <div className="text-xs font-medium text-[var(--text-secondary)]">From</div>
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label={labelWithOverride('X')}
              value={getFieldValue(
                'scale.from.x',
                getOverrideValue<number>('from.x'),
                track.properties.from.x
              )}
              onChange={(x) =>
                onChange({
                  from: { x },
                } as Partial<ScaleTrackProperties>)
              }
              step={0.1}
              defaultValue={1}
              bindAdornment={bindAdornment('scale.from.x')}
              disabled={isFieldBound('scale.from.x')}
              inputClassName={leftBorderClass('scale.from.x')}
            />
            {(isFieldOverridden('scale.from.x') || isFieldBound('scale.from.x')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="scale.from.x" />
              </div>
            )}
          </div>
          <div>
            <NumberField
              label={labelWithOverride('Y')}
              value={getFieldValue(
                'scale.from.y',
                getOverrideValue<number>('from.y'),
                track.properties.from.y
              )}
              onChange={(y) =>
                onChange({
                  from: { y },
                } as Partial<ScaleTrackProperties>)
              }
              step={0.1}
              defaultValue={1}
              bindAdornment={bindAdornment('scale.from.y')}
              disabled={isFieldBound('scale.from.y')}
              inputClassName={leftBorderClass('scale.from.y')}
            />
            {(isFieldOverridden('scale.from.y') || isFieldBound('scale.from.y')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="scale.from.y" />
              </div>
            )}
          </div>
        </div>
        <div className="text-xs font-medium text-[var(--text-secondary)]">To</div>
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label={labelWithOverride('X')}
              value={getFieldValue(
                'scale.to.x',
                getOverrideValue<number>('to.x'),
                track.properties.to.x
              )}
              onChange={(x) =>
                onChange({
                  to: { x },
                } as Partial<ScaleTrackProperties>)
              }
              step={0.1}
              defaultValue={1.5}
              bindAdornment={bindAdornment('scale.to.x')}
              disabled={isFieldBound('scale.to.x')}
              inputClassName={leftBorderClass('scale.to.x')}
            />
            {(isFieldOverridden('scale.to.x') || isFieldBound('scale.to.x')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="scale.to.x" />
              </div>
            )}
          </div>
          <div>
            <NumberField
              label={labelWithOverride('Y')}
              value={getFieldValue(
                'scale.to.y',
                getOverrideValue<number>('to.y'),
                track.properties.to.y
              )}
              onChange={(y) =>
                onChange({
                  to: { y },
                } as Partial<ScaleTrackProperties>)
              }
              step={0.1}
              defaultValue={1.5}
              bindAdornment={bindAdornment('scale.to.y')}
              disabled={isFieldBound('scale.to.y')}
              inputClassName={leftBorderClass('scale.to.y')}
            />
            {(isFieldOverridden('scale.to.y') || isFieldBound('scale.to.y')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="scale.to.y" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
