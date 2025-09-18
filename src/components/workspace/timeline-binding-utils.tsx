import { useCallback, useMemo } from 'react';
import type { FC, ReactNode } from 'react';
import { BindButton } from '@/components/workspace/binding/bindings';
import {
  BindingBadge as UnifiedBindingBadge,
  OverrideBadge as UnifiedOverrideBadge,
} from '@/components/workspace/binding/badges';
import { BindingAndBatchControls } from '@/components/workspace/batch/BindingAndBatchControls';
import { useWorkspace } from '@/components/workspace/workspace-context';
import type { TrackOverride } from '@/shared/properties/assignments';
import { getResolverFieldPath } from '@/shared/properties/field-paths';
import type { AnimationNodeData } from '@/shared/types/nodes';

const TIMELINE_OVERRIDE_PATHS: Record<string, string[]> = {
  'move.from.x': ['from', 'x'],
  'move.from.y': ['from', 'y'],
  'move.to.x': ['to', 'x'],
  'move.to.y': ['to', 'y'],
  'slide.orientationDeg': ['orientationDeg'],
  'slide.velocity': ['velocity'],
  'rotate.from': ['from'],
  'rotate.to': ['to'],
  'scale.from.x': ['from', 'x'],
  'scale.from.y': ['from', 'y'],
  'scale.to.x': ['to', 'x'],
  'scale.to.y': ['to', 'y'],
  'fade.from': ['from'],
  'fade.to': ['to'],
  'color.property': ['property'],
  'color.from': ['from'],
  'color.to': ['to'],
} as const;

type BoundRecord = Record<string, { boundResultNodeId?: string }> | undefined;

interface UseTimelineFieldHelpersArgs {
  animationNodeId: string;
  trackIdentifierId: string;
  override?: TrackOverride;
  selectedObjectId?: string;
}

export interface TimelineFieldHelpers {
  bindAdornment: (fieldKey: string) => ReactNode;
  getFieldValue: <T>(fieldKey: string, overrideValue: T | undefined, defaultValue: T) => T | undefined;
  getOverrideValue: <T>(path: string) => T | undefined;
  isFieldBound: (fieldKey: string) => boolean;
  isFieldOverridden: (fieldKey: string) => boolean;
  FieldBadges: FC<{ keyName: string }>;
  leftBorderClass: (fieldKey: string) => string;
}

const getValueAtPath = (source: unknown, pathSegments: string[]): unknown => {
  if (!source) return undefined;
  return pathSegments.reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
};

export function useTimelineFieldHelpers({
  animationNodeId,
  trackIdentifierId,
  override,
  selectedObjectId,
}: UseTimelineFieldHelpersArgs): TimelineFieldHelpers {
  const { state } = useWorkspace();

  const animationNodeData = useMemo<AnimationNodeData | undefined>(() => {
    const node = state.flow.nodes.find((n) => n.data?.identifier?.id === animationNodeId);
    return node?.data as AnimationNodeData | undefined;
  }, [state.flow.nodes, animationNodeId]);

  const getOverrideValue = useCallback(
    <T,>(path: string): T | undefined => {
      if (!override?.properties) return undefined;
      const segments = path.split('.');
      const value = getValueAtPath(override.properties, segments);
      return value as T | undefined;
    },
    [override]
  );

  const isFieldOverridden = useCallback(
    (fieldKey: string) => {
      if (!override?.properties) return false;
      const path = TIMELINE_OVERRIDE_PATHS[fieldKey];
      if (!path) return false;
      return getValueAtPath(override.properties, path) !== undefined;
    },
    [override]
  );

  const isFieldBound = useCallback(
    (fieldKey: string) => {
      if (!animationNodeData) return false;
      const scopedKey = `track.${trackIdentifierId}.${fieldKey}`;
      const vbGlobal = animationNodeData.variableBindings as BoundRecord;

      if (selectedObjectId) {
        const vbByObject = animationNodeData.variableBindingsByObject as
          | Record<string, BoundRecord>
          | undefined;
        const vbForObject = vbByObject?.[selectedObjectId];
        const direct = vbForObject?.[scopedKey]?.boundResultNodeId ?? vbForObject?.[fieldKey]?.boundResultNodeId;
        if (direct) return true;
      }

      return !!(
        vbGlobal?.[scopedKey]?.boundResultNodeId ?? vbGlobal?.[fieldKey]?.boundResultNodeId
      );
    },
    [animationNodeData, selectedObjectId, trackIdentifierId]
  );

  const bindAdornment = useCallback(
    (fieldKey: string): ReactNode => {
      const fieldPath = getResolverFieldPath('timeline', fieldKey);
      if (!fieldPath) {
        return (
          <BindButton
            nodeId={animationNodeId}
            bindingKey={`track.${trackIdentifierId}.${fieldKey}`}
            objectId={selectedObjectId}
          />
        );
      }

      const valueType: 'number' | 'string' = fieldKey.includes('color') ? 'string' : 'number';

      return (
        <BindingAndBatchControls
          bindProps={{
            nodeId: animationNodeId,
            bindingKey: `track.${trackIdentifierId}.${fieldKey}`,
            objectId: selectedObjectId,
          }}
          batchProps={{
            nodeId: animationNodeId,
            fieldPath,
            objectId: selectedObjectId,
            valueType,
          }}
        />
      );
    },
    [animationNodeId, selectedObjectId, trackIdentifierId]
  );

  const getFieldValue = useCallback(
    <T,>(fieldKey: string, overrideValue: T | undefined, defaultValue: T): T | undefined => {
      if (isFieldBound(fieldKey)) return undefined;
      return overrideValue ?? defaultValue;
    },
    [isFieldBound]
  );

  const FieldBadges = useCallback<FC<{ keyName: string }>>(
    ({ keyName }) => (
      <div className="flex items-center gap-[var(--space-1)]">
        {isFieldOverridden(keyName) ? (
          <UnifiedOverrideBadge
            nodeId={animationNodeId}
            bindingKey={`track.${trackIdentifierId}.${keyName}`}
            objectId={selectedObjectId}
          />
        ) : (
          <UnifiedBindingBadge
            nodeId={animationNodeId}
            bindingKey={`track.${trackIdentifierId}.${keyName}`}
            objectId={selectedObjectId}
          />
        )}
      </div>
    ),
    [animationNodeId, isFieldOverridden, selectedObjectId, trackIdentifierId]
  );

  const leftBorderClass = useCallback(
    (fieldKey: string) =>
      isFieldBound(fieldKey)
        ? 'border-l-2 border-[var(--accent-secondary)]'
        : isFieldOverridden(fieldKey)
          ? 'border-l-2 border-[var(--warning-600)]'
          : '',
    [isFieldBound, isFieldOverridden]
  );

  return {
    bindAdornment,
    getFieldValue,
    getOverrideValue,
    isFieldBound,
    isFieldOverridden,
    FieldBadges,
    leftBorderClass,
  };
}
