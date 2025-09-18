import { ColorField, SelectField } from '@/components/ui/form-fields';
import type { AnimationTrack, ColorTrackProperties } from '@/shared/types/nodes';
import type { TimelineFieldHelpers } from '../timeline-binding-utils';

interface ColorTrackPanelProps {
  track: Extract<AnimationTrack, { type: 'color' }>;
  onChange: (updates: Partial<ColorTrackProperties>) => void;
  helpers: TimelineFieldHelpers;
  labelWithOverride: (label: string) => string;
}

export function ColorTrackPanel({
  track,
  onChange,
  helpers,
  labelWithOverride,
}: ColorTrackPanelProps) {
  const {
    bindAdornment,
    getFieldValue,
    getOverrideValue,
    isFieldBound,
    isFieldOverridden,
    FieldBadges,
    leftBorderClass,
  } = helpers;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="border-b border-[var(--border-primary)] pb-[var(--space-2)] text-sm font-medium text-[var(--text-primary)]">
        Color Properties
      </div>
      <SelectField
        label={labelWithOverride('Property')}
        value={
          getFieldValue(
            'color.property',
            getOverrideValue<string>('property'),
            track.properties.property
          ) ?? track.properties.property
        }
        onChange={(property) => onChange({ property: property as 'fill' | 'stroke' })}
        options={[
          { value: 'fill', label: 'Fill' },
          { value: 'stroke', label: 'Stroke' },
        ]}
      />
      <div className="space-y-[var(--space-2)]">
        <div className="text-xs font-medium text-[var(--text-secondary)]">Color Values</div>
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <ColorField
              label={labelWithOverride('From')}
              value={
                getFieldValue(
                  'color.from',
                  getOverrideValue<string>('from'),
                  track.properties.from
                ) ?? track.properties.from
              }
              onChange={(from) => onChange({ from })}
              bindAdornment={bindAdornment('color.from')}
              disabled={isFieldBound('color.from')}
              inputClassName={leftBorderClass('color.from')}
            />
            {(isFieldOverridden('color.from') || isFieldBound('color.from')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="color.from" />
              </div>
            )}
          </div>
          <div>
            <ColorField
              label={labelWithOverride('To')}
              value={
                getFieldValue('color.to', getOverrideValue<string>('to'), track.properties.to) ??
                track.properties.to
              }
              onChange={(to) => onChange({ to })}
              bindAdornment={bindAdornment('color.to')}
              disabled={isFieldBound('color.to')}
              inputClassName={leftBorderClass('color.to')}
            />
            {(isFieldOverridden('color.to') || isFieldBound('color.to')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <FieldBadges keyName="color.to" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
