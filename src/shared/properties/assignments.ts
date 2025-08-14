// src/shared/properties/assignments.ts

import type { Point2D } from '@/shared/types/core';

// Initial/static overrides applied before animation evaluation
export interface ObjectInitialOverrides {
  position?: Point2D;
  rotation?: number;
  scale?: Point2D;
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
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
export function mergeObjectAssignments(base: ObjectAssignments | undefined, overrides: ObjectAssignments | undefined): ObjectAssignments | undefined {
  if (!base && !overrides) return undefined;
  const initial: ObjectInitialOverrides | undefined = {
    ...(base?.initial ?? {}),
    ...(overrides?.initial ?? {}),
  };

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
    const key = t.trackId ? `id:${t.trackId}` : t.type ? `type:${t.type}` : `idx:${mergedTracks.length}`;
    index.set(key, t);
  }

  for (const t of overrideTracks) {
    const key = t.trackId ? `id:${t.trackId}` : t.type ? `type:${t.type}` : undefined;
    if (key && index.has(key)) {
      const baseT = index.get(key)!;
      index.set(key, {
        trackId: t.trackId ?? baseT.trackId,
        type: t.type ?? baseT.type,
        properties: { ...(baseT.properties ?? {}), ...(t.properties ?? {}) },
        startTime: t.startTime ?? baseT.startTime,
        duration: t.duration ?? baseT.duration,
        easing: (t.easing ?? baseT.easing) as TrackOverride['easing'],
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