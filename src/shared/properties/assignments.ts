// src/shared/properties/assignments.ts

import type { Point2D } from '@/shared/types/core';
import { deepMerge, isPlainObject } from '@/shared/utils/object-path';

// Initial/static overrides applied before animation evaluation
export interface ObjectInitialOverrides {
  position?: Point2D;
  rotation?: number;
  scale?: Point2D;
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  [key: string]: unknown;
}

// Per-track override for animation conversion time
export interface TrackOverride {
  // Prefer matching by canonical track identifier if provided
  trackId?: string;
  // Fallback: match by transform type when trackId not available
  type?: string;
  // Partial properties to override; keys depend on track type
  properties?: Record<string, unknown>;
  // Optional timeline overrides (still relative to baseline/time cursor)
  startTime?: number;
  duration?: number;
  easing?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  [key: string]: unknown;
}

export interface ObjectAssignments {
  initial?: ObjectInitialOverrides;
  tracks?: TrackOverride[];
}

// Map objectId -> assignments
export type PerObjectAssignments = Record<string, ObjectAssignments>;

export function isPoint2D(value: unknown): value is Point2D {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).x === 'number' &&
    typeof (value as Record<string, unknown>).y === 'number'
  );
}

export function isObjectInitialOverrides(value: unknown): value is ObjectInitialOverrides {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.position !== undefined && !isPoint2D(v.position)) return false;
  if (v.scale !== undefined && !isPoint2D(v.scale)) return false;
  if (v.rotation !== undefined && typeof v.rotation !== 'number') return false;
  if (v.opacity !== undefined && typeof v.opacity !== 'number') return false;
  if (v.fillColor !== undefined && typeof v.fillColor !== 'string') return false;
  if (v.strokeColor !== undefined && typeof v.strokeColor !== 'string') return false;
  if (v.strokeWidth !== undefined && typeof v.strokeWidth !== 'number') return false;
  return true;
}

export function isTrackOverride(value: unknown): value is TrackOverride {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.trackId !== undefined && typeof v.trackId !== 'string') return false;
  if (v.type !== undefined && typeof v.type !== 'string') return false;
  if (v.properties !== undefined && typeof v.properties !== 'object') return false;
  if (v.startTime !== undefined && typeof v.startTime !== 'number') return false;
  if (v.duration !== undefined && typeof v.duration !== 'number') return false;
  if (v.easing !== undefined && typeof v.easing !== 'string') return false;
  return true;
}

export function isObjectAssignments(value: unknown): value is ObjectAssignments {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.initial !== undefined && !isObjectInitialOverrides(v.initial)) return false;
  if (v.tracks !== undefined) {
    if (!Array.isArray(v.tracks)) return false;
    if (!v.tracks.every(isTrackOverride)) return false;
  }
  return true;
}

export function isPerObjectAssignments(value: unknown): value is PerObjectAssignments {
  if (typeof value !== 'object' || value === null) return false;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (!isObjectAssignments(entry)) return false;
  }
  return true;
}

// Merge two ObjectAssignments: `overrides` takes precedence over `base`
export function mergeObjectAssignments(
  base: ObjectAssignments | undefined,
  overrides: ObjectAssignments | undefined
): ObjectAssignments | undefined {
  if (!base && !overrides) return undefined;
  // Deep-merge initial so sub-fields (e.g., position.x) are preserved
  const initial: ObjectInitialOverrides | undefined = (() => {
    const b = base?.initial ?? {};
    const o = overrides?.initial ?? {};
    return deepMerge(b, o);
  })();

  // Track overrides: prefer entries from `overrides` when they explicitly match the same trackId or type
  const baseTracks = base?.tracks ?? [];
  const overrideTracks = overrides?.tracks ?? [];

  if (baseTracks.length === 0 && overrideTracks.length === 0) {
    return Object.keys(initial).length > 0 ? { initial } : {};
  }

  const mergedTracks: TrackOverride[] = [];

  // Index base by (trackId || type)
  const index = new Map<string, TrackOverride>();
  for (const t of baseTracks) {
    const key = t.trackId
      ? `id:${t.trackId}`
      : t.type
        ? `type:${t.type}`
        : `idx:${mergedTracks.length}`;
    index.set(key, t);
  }

  for (const t of overrideTracks) {
    const key = t.trackId ? `id:${t.trackId}` : t.type ? `type:${t.type}` : undefined;
    if (key && index.has(key)) {
      const baseT = index.get(key)!;
      // Deep-merge nested properties
      const mergedProps = deepMerge(baseT.properties ?? {}, t.properties ?? {});
      // Special-case from/to to ensure nested partials merge even if either side is non-plain (defensive)
      if (isPlainObject(baseT.properties?.from) && isPlainObject(t.properties?.from)) {
        mergedProps.from = deepMerge(baseT.properties.from, t.properties.from);
      }
      if (isPlainObject(baseT.properties?.to) && isPlainObject(t.properties?.to)) {
        mergedProps.to = deepMerge(baseT.properties.to, t.properties.to);
      }
      index.set(key, {
        trackId: t.trackId ?? baseT.trackId,
        type: t.type ?? baseT.type,
        properties: mergedProps,
        startTime: t.startTime ?? baseT.startTime,
        duration: t.duration ?? baseT.duration,
        easing: t.easing ?? baseT.easing,
      });
    } else if (key) {
      index.set(key, t);
    } else {
      // No key; append uniquely
      mergedTracks.push(t);
    }
  }

  // Push indexed (merged) tracks and any non-keyed base tracks not overridden
  const indexedMerged = Array.from(index.values());
  mergedTracks.unshift(...indexedMerged);

  const result: ObjectAssignments = {};
  if (Object.keys(initial).length > 0) result.initial = initial;
  if (mergedTracks.length > 0) result.tracks = mergedTracks;
  return result;
}


export interface PerObjectAssignmentUpdateOptions {
  /**
   * Keys whose values should be shallow merged when both the existing initial value
   * and the incoming update are plain objects (e.g., position, scale).
   */
  nestedKeys?: string[];
  /**
   * When true, remove the per-object entry entirely if the merged initial overrides are empty.
   */
  removeWhenEmpty?: boolean;
}

export function applyPerObjectAssignmentUpdate(
  assignments: PerObjectAssignments | undefined,
  objectId: string,
  updates: Record<string, unknown>,
  options: PerObjectAssignmentUpdateOptions = {}
): PerObjectAssignments {
  const { nestedKeys = [], removeWhenEmpty = false } = options;
  const source = assignments ?? {};
  const next: PerObjectAssignments = { ...source };
  const current: ObjectAssignments = { ...(next[objectId] ?? {}) };
  const baseInitial = { ...(current.initial ?? {}) } as Record<string, unknown>;

  let mergedInitial: Record<string, unknown> = {
    ...baseInitial,
    ...updates,
  };

  for (const key of nestedKeys) {
    const baseValue = baseInitial[key];
    const updateValue = updates[key];
    if (isPlainObject(baseValue) && isPlainObject(updateValue)) {
      mergedInitial = {
        ...mergedInitial,
        [key]: {
          ...(baseValue as Record<string, unknown>),
          ...(updateValue as Record<string, unknown>),
        },
      };
    }
  }

  mergedInitial = Object.fromEntries(
    Object.entries(mergedInitial).filter(([, value]) => value !== undefined)
  );

  if (removeWhenEmpty && Object.keys(mergedInitial).length === 0) {
    delete next[objectId];
    return next;
  }

  const nextAssignment: ObjectAssignments = {
    ...current,
    initial: mergedInitial as ObjectInitialOverrides,
  };

  next[objectId] = nextAssignment;
  return next;
}

export function clearPerObjectAssignment(
  assignments: PerObjectAssignments | undefined,
  objectId: string
): PerObjectAssignments {
  const source = assignments ?? {};
  if (!(objectId in source)) {
    return source === assignments ? source : { ...source };
  }
  const next: PerObjectAssignments = { ...source };
  delete next[objectId];
  return next;
}
