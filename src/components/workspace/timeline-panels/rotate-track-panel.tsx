import { NumberField } from '@/components/ui/form-fields';
import type { AnimationTrack, RotateTrackProperties } from '@/shared/types/nodes';
import type { TimelineFieldHelpers } from '../timeline-binding-utils';

interface RotateTrackPanelProps {
  track: Extract<AnimationTrack, { type: 'rotate' }>;
  onChange: (updates: Partial<RotateTrackProperties>) => void;
  helpers: TimelineFieldHelpers;
  labelWithOverride: (label: string) => string;
}

export function RotateTrackPanel({
  track,
  onChange,
  helpers,
  labelWithOverride,
}: RotateTrackPanelProps) {
  const {
    bindAdornment,
    getFieldValue,
    getOverrideValue,
    isFieldBound,
    hasBinding,
    isFieldOverridden,
    FieldBadges,
    leftBorderClass,
  } = helpers;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
        Rotate Properties
      </div>
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <div>
          <NumberField
            label={labelWithOverride('From')}
            value={getFieldValue(
              'rotate.from',
              getOverrideValue<number>('from'),
              track.properties.from
            )}
            onChange={(from) => onChange({ from })}
            step={0.1}
            defaultValue={0}
            bindAdornment={bindAdornment('rotate.from')}
            disabled={isFieldBound('rotate.from')}
            inputClassName={leftBorderClass('rotate.from')}
          />
          {(isFieldOverridden('rotate.from') || hasBinding('rotate.from')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <FieldBadges keyName="rotate.from" />
            </div>
          )}
        </div>
        <div>
          <NumberField
            label={labelWithOverride('To')}
            value={getFieldValue('rotate.to', getOverrideValue<number>('to'), track.properties.to)}
            onChange={(to) => onChange({ to })}
            step={0.1}
            defaultValue={1}
            bindAdornment={bindAdornment('rotate.to')}
            disabled={isFieldBound('rotate.to')}
            inputClassName={leftBorderClass('rotate.to')}
          />
          {(isFieldOverridden('rotate.to') || hasBinding('rotate.to')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <FieldBadges keyName="rotate.to" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
