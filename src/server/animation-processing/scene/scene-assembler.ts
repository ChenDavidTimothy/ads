// src/server/animation-processing/scene/scene-assembler.ts
import type { AnimationTrack } from "@/shared/types";
import type { SceneAnimationTrack } from "@/shared/types/scene";
import type { SceneTransform } from "@/shared/types/transforms";
import { transformFactory } from "@/shared/registry/transforms";
import { transformEvaluator } from "@/shared/registry/transform-evaluator";
import type { Point2D } from "@/shared/types/core";
// Legacy imports removed - using granular system

export type PerObjectCursorMap = Record<string, number>;

export function isPerObjectCursorMap(value: unknown): value is PerObjectCursorMap {
  if (typeof value !== 'object' || value === null) return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== 'number') return false;
  }
  return true;
}

export function mergeCursorMaps(cursorMaps: PerObjectCursorMap[]): PerObjectCursorMap {
  const merged: PerObjectCursorMap = {};
  for (const map of cursorMaps) {
    for (const [objectId, time] of Object.entries(map)) {
      if (!(objectId in merged)) {
        merged[objectId] = time;
      } else {
        merged[objectId] = Math.max(merged[objectId]!, time);
      }
    }
  }
  return merged;
}

export function pickCursorsForIds(cursorMap: PerObjectCursorMap, ids: string[]): PerObjectCursorMap {
  const picked: PerObjectCursorMap = {};
  for (const id of ids) {
    if (id in cursorMap) picked[id] = cursorMap[id]!;
  }
  return picked;
}

// Legacy track override functions removed - using granular system

export function convertTracksToSceneAnimations(
  tracks: AnimationTrack[],
  objectId: string,
  baselineTime: number,
  priorAnimations: SceneAnimationTrack[] = [],
  perObjectAssignments?: PerObjectAssignments
): SceneAnimationTrack[] {
  // Helper: deep-ish equality for 'from' defaults
  const isDefaultFrom = (type: string, value: unknown): boolean => {
    const defaults = transformFactory.getDefaultProperties(type);
    if (!defaults) return false;
    const def = defaults.from;
    switch (type) {
      case 'move': {
        if (typeof def === 'object' && def !== null && 'x' in def && 'y' in def) {
          const v = value as Point2D | undefined;
          const d = def as { x: number; y: number };
          return !!v && v.x === d.x && v.y === d.y;
        }
        return false;
      }
      case 'rotate':
      case 'scale':
      case 'fade':
        return typeof def === 'number' && value === def;
      case 'color':
        return typeof def === 'string' && value === def;
      default:
        return false;
    }
  };

  // Helper: get target property for a transform type
  const getTargetProperty = (type: string): string | undefined => {
    return transformFactory.getTransformDefinition(type)?.metadata?.targetProperty;
  };

  // Helper: compute last value at a given absolute time from prior animations for the same target property
  const getPriorValue = (
    targetProperty: string | undefined,
    atTime: number,
    currentTrack?: AnimationTrack
  ): unknown => {
    if (!targetProperty) return undefined;
    // Filter animations for this object and same target property
    let relevant = priorAnimations.filter(a => a.objectId === objectId && getTargetProperty(a.type) === targetProperty);

    // Special-case color: restrict to same fill/stroke property
    if (currentTrack?.type === 'color') {
      const prop = currentTrack.properties.property;
      relevant = relevant.filter(a => a.type === 'color' && a.properties.property === prop);
    }
    if (relevant.length === 0) return undefined;

    // Prefer animations that have fully completed by 'atTime'
    const completed = relevant
      .filter(a => atTime >= a.startTime + a.duration)
      .sort((a, b) => (a.startTime + a.duration) - (b.startTime + b.duration));
    if (completed.length > 0) {
      const last = completed[completed.length - 1]!;
      return transformEvaluator.getEndValue(sceneTrackToTransform(last));
    }

    // Otherwise, if an animation is active at 'atTime', sample it
    const active = relevant.find(a => atTime >= a.startTime && atTime < a.startTime + a.duration);
    if (active) {
      return transformEvaluator.evaluateTransform(sceneTrackToTransform(active), atTime);
    }

    return undefined;
  };

  // Helper: get the end value of a track from the same animation sequence
  const getEndValueFromSameSequence = (
    track: AnimationTrack,
    allTracks: AnimationTrack[],
    targetProperty: string | undefined
  ): unknown => {
    if (!targetProperty) return undefined;
    
    // Find tracks of the same type that come before this one in the same sequence
    const sameTypeTracks = allTracks
      .filter(t => t.type === track.type && t.startTime < track.startTime)
      .sort((a, b) => b.startTime - a.startTime); // Most recent first
    
    if (sameTypeTracks.length === 0) return undefined;
    
    // Get the end value of the most recent track of the same type
    const mostRecent = sameTypeTracks[0]!;
    switch (mostRecent.type) {
      case 'move':
        return mostRecent.properties.to;
      case 'rotate':
        return mostRecent.properties.to;
      case 'scale':
        return mostRecent.properties.to;
      case 'fade':
        return mostRecent.properties.to;
      case 'color':
        return mostRecent.properties.to;
      default:
        return undefined;
    }
  };

  const sortedTracks = [...tracks].sort((a, b) => a.startTime - b.startTime);
  const sceneTracks: SceneAnimationTrack[] = [];

  // Resolve object-specific track overrides once
  const objectOverrides = perObjectAssignments?.[objectId];
  const perTrackOverrides = objectOverrides?.tracks ?? [];

  for (const track of sortedTracks) {
    // Apply per-object track override if any; falls back to original track otherwise
    const matchedOverride = pickOverridesForTrack(perTrackOverrides, track);
    const baseTrack = matchedOverride ? applyTrackOverride(track, matchedOverride) : track;

    const effectiveStart = baselineTime + baseTrack.startTime;
    const targetProperty = getTargetProperty(baseTrack.type);

    // Clone properties so we can adjust 'from' if chaining applies
    const properties = { ...baseTrack.properties } as typeof baseTrack.properties;

    // Priority order for 'from' value:
    // 1. Explicit 'from' value in track properties (must NEVER be overridden)
    // 2. End value from previous track of same type in the same sequence
    // 3. End value from prior animations for this object
    // 4. Default 'from' value
    const defaults = transformFactory.getDefaultProperties(baseTrack.type) as unknown as { from?: unknown } | undefined;
    const defaultFrom = defaults?.from as unknown;

    // Compute inherited end value we might chain from
    let inherited: unknown = undefined;
    const tryComputeInherited = () => {
      if (inherited !== undefined) return inherited;
      let inh = getEndValueFromSameSequence(baseTrack, sortedTracks, targetProperty);
      if (inh === undefined) {
        inh = getPriorValue(targetProperty, effectiveStart, baseTrack);
      }
      inherited = inh;
      return inherited;
    };

    if (baseTrack.type === 'move') {
      const bf = (baseTrack.properties as any)?.from as { x?: number; y?: number } | undefined;
      const pf = (properties as any)?.from as { x?: number; y?: number } | undefined;
      const df = (defaultFrom as any) as { x?: number; y?: number } | undefined;
      const ov = (matchedOverride?.properties as any)?.from as { x?: number; y?: number } | undefined;
      const inh = (tryComputeInherited() as any) as { x?: number; y?: number } | undefined;

      const nextFrom: { x?: number; y?: number } = { ...(pf ?? {}) };
      // Per-axis explicit detection: explicit if override touched that axis or if base deviates from default
      const xExplicit = (ov && Object.prototype.hasOwnProperty.call(ov, 'x')) || (bf?.x !== undefined && df?.x !== undefined && bf.x !== df.x);
      const yExplicit = (ov && Object.prototype.hasOwnProperty.call(ov, 'y')) || (bf?.y !== undefined && df?.y !== undefined && bf.y !== df.y);

      if (!xExplicit) {
        if ((pf?.x === undefined) || (df?.x !== undefined && pf?.x === df.x)) {
          if (inh?.x !== undefined) nextFrom.x = inh.x;
        }
      }
      if (!yExplicit) {
        if ((pf?.y === undefined) || (df?.y !== undefined && pf?.y === df.y)) {
          if (inh?.y !== undefined) nextFrom.y = inh.y;
        }
      }
      if (Object.keys(nextFrom).length > 0) {
        (properties as unknown as Record<string, unknown>).from = nextFrom as unknown;
      }
    } else {
      // Scalar or non-vector case: keep previous logic, but do not override when explicitly set or non-default
      const fromExplicitByOverride = !!(matchedOverride && Object.prototype.hasOwnProperty.call(matchedOverride.properties ?? {}, 'from'));
      const fromIsNonDefault = !isDefaultFrom(baseTrack.type, (baseTrack as any)?.properties?.from);
      const isFromExplicit = fromExplicitByOverride || fromIsNonDefault;
      if (!isFromExplicit && (properties as any).from !== undefined && defaultFrom !== undefined && isDefaultFrom(baseTrack.type, (properties as any).from)) {
        const inh = tryComputeInherited();
        if (inh !== undefined) {
          (properties as unknown as Record<string, unknown>).from = inh as unknown;
        }
      }
      if (!isFromExplicit && (properties as any).from === undefined) {
        const inh = tryComputeInherited();
        if (inh !== undefined) {
          (properties as unknown as Record<string, unknown>).from = inh as unknown;
        }
      }
    }

    // Use the registry system to create scene transforms
    const sceneTransform = transformFactory.createSceneTransform(
      {
        id: baseTrack.identifier.id,
        type: baseTrack.type,
        startTime: baseTrack.startTime,
        duration: baseTrack.duration,
        easing: baseTrack.easing,
        properties: properties as unknown as Record<string, unknown>,
      },
      objectId,
      baselineTime
    );

    // Push typed scene animation track with a stable, collision-safe id
    const canonicalTrackId = baseTrack.identifier.id;
    sceneTracks.push({
      id: `${objectId}::${canonicalTrackId}::${effectiveStart}`,
      ...sceneTransform,
      properties: properties as SceneAnimationTrack['properties'],
    } as SceneAnimationTrack);
  }

  return sceneTracks;
}

function sceneTrackToTransform(track: SceneAnimationTrack): SceneTransform {
  return {
    objectId: track.objectId,
    type: track.type,
    startTime: track.startTime,
    duration: track.duration,
    easing: track.easing,
    properties: track.properties,
  };
}

export function extractObjectIdsFromInputs(inputs: Array<{ data: unknown }>): string[] {
  const ids: string[] = [];
  for (const input of inputs) {
    const items = Array.isArray(input.data) ? input.data : [input.data];
    for (const item of items) {
      if (typeof item === 'object' && item !== null && 'id' in item) {
        const id = (item as { id: unknown }).id;
        if (typeof id === 'string') {
          ids.push(id);
        }
      }
    }
  }
  return ids;
}


