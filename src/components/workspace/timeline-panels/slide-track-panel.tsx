import { NumberField } from '@/components/ui/form-fields';
import type { AnimationTrack, SlideTrackProperties } from '@/shared/types/nodes';
import type { TimelineFieldHelpers } from '../timeline-binding-utils';

interface SlideTrackPanelProps {
  track: Extract<AnimationTrack, { type: 'slide' }>;
  onChange: (updates: Partial<SlideTrackProperties>) => void;
  helpers: TimelineFieldHelpers;
  labelWithOverride: (label: string) => string;
}

export function SlideTrackPanel({
  track,
  onChange,
  helpers,
  labelWithOverride,
}: SlideTrackPanelProps) {
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
        Slide Properties
      </div>
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <div>
          <NumberField
            label={labelWithOverride('Orientation (deg)')}
            value={getFieldValue(
              'slide.orientationDeg',
              getOverrideValue<number>('orientationDeg'),
              track.properties.orientationDeg
            )}
            onChange={(orientationDeg) =>
              onChange({
                orientationDeg,
              } as Partial<SlideTrackProperties>)
            }
            step={1}
            defaultValue={0}
            bindAdornment={bindAdornment('slide.orientationDeg')}
            disabled={isFieldBound('slide.orientationDeg')}
            inputClassName={leftBorderClass('slide.orientationDeg')}
          />
          {(isFieldOverridden('slide.orientationDeg') || hasBinding('slide.orientationDeg')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <FieldBadges keyName="slide.orientationDeg" />
            </div>
          )}
        </div>
        <div>
          <NumberField
            label={labelWithOverride('Velocity (px/s)')}
            value={getFieldValue(
              'slide.velocity',
              getOverrideValue<number>('velocity'),
              track.properties.velocity
            )}
            onChange={(velocity) =>
              onChange({
                velocity,
              } as Partial<SlideTrackProperties>)
            }
            step={1}
            defaultValue={100}
            bindAdornment={bindAdornment('slide.velocity')}
            disabled={isFieldBound('slide.velocity')}
            inputClassName={leftBorderClass('slide.velocity')}
          />
          {(isFieldOverridden('slide.velocity') || hasBinding('slide.velocity')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <FieldBadges keyName="slide.velocity" />
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-[var(--text-tertiary)]">
        Slide is relative and additive; it doesn??Tt overwrite position.
      </div>
    </div>
  );
}
