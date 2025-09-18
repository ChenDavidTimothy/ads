import { NumberField } from '@/components/ui/form-fields';
import type { AnimationTrack, FadeTrackProperties } from '@/shared/types/nodes';
import type { TimelineFieldHelpers } from '../timeline-binding-utils';

interface FadeTrackPanelProps {
  track: Extract<AnimationTrack, { type: 'fade' }>;
  onChange: (updates: Partial<FadeTrackProperties>) => void;
  helpers: TimelineFieldHelpers;
  labelWithOverride: (label: string) => string;
}

export function FadeTrackPanel({
  track,
  onChange,
  helpers,
  labelWithOverride,
}: FadeTrackPanelProps) {
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
        Fade Properties
      </div>
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <div>
          <NumberField
            label={labelWithOverride('From')}
            value={getFieldValue(
              'fade.from',
              getOverrideValue<number>('from'),
              track.properties.from
            )}
            onChange={(from) => onChange({ from })}
            step={0.05}
            defaultValue={1}
            bindAdornment={bindAdornment('fade.from')}
            disabled={isFieldBound('fade.from')}
            inputClassName={leftBorderClass('fade.from')}
          />
          {(isFieldOverridden('fade.from') || hasBinding('fade.from')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <FieldBadges keyName="fade.from" />
            </div>
          )}
        </div>
        <div>
          <NumberField
            label={labelWithOverride('To')}
            value={getFieldValue('fade.to', getOverrideValue<number>('to'), track.properties.to)}
            onChange={(to) => onChange({ to })}
            step={0.05}
            defaultValue={0}
            bindAdornment={bindAdornment('fade.to')}
            disabled={isFieldBound('fade.to')}
            inputClassName={leftBorderClass('fade.to')}
          />
          {(isFieldOverridden('fade.to') || hasBinding('fade.to')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <FieldBadges keyName="fade.to" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
