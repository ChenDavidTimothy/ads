// src/server/animation-processing/scene/scene-assembler.ts
import type { AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import { transformFactory } from "@/shared/registry/transforms";
import { transformEvaluator } from "@/shared/registry/transform-evaluator";
import type { Point2D } from "@/shared/types/core";

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

export function convertTracksToSceneAnimations(
  tracks: AnimationTrack[],
  objectId: string,
  baselineTime: number,
  priorAnimations: SceneAnimationTrack[] = []
): SceneAnimationTrack[] {
  // Helper: deep-ish equality for 'from' defaults
  const isDefaultFrom = (type: string, value: unknown): boolean => {
    const defaults = transformFactory.getDefaultProperties(type) as any | undefined;
    if (!defaults) return false;
    const def = (defaults as any).from;
    if (typeof def === 'number') return value === def;
    if (typeof def === 'string') return value === def;
    if (typeof def === 'object' && def && typeof (def as any).x === 'number' && typeof (def as any).y === 'number') {
      const v = value as Point2D | undefined;
      return !!v && v.x === (def as any).x && v.y === (def as any).y;
    }
    return false;
  };

  // Helper: get target property for a transform type
  const getTargetProperty = (type: string): string | undefined => {
    return transformFactory.getTransformDefinition(type)?.metadata?.targetProperty as string | undefined;
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
      const prop = (currentTrack.properties as any)?.property;
      relevant = relevant.filter(a => a.type === 'color' && (a.properties as any)?.property === prop);
    }
    if (relevant.length === 0) return undefined;

    // Prefer animations that have fully completed by 'atTime'
    const completed = relevant
      .filter(a => atTime >= a.startTime + a.duration)
      .sort((a, b) => (a.startTime + a.duration) - (b.startTime + b.duration));
    if (completed.length > 0) {
      const last = completed[completed.length - 1]!;
      return transformEvaluator.getEndValue(last as any);
    }

    // Otherwise, if an animation is active at 'atTime', sample it
    const active = relevant.find(a => atTime >= a.startTime && atTime < a.startTime + a.duration);
    if (active) {
      return transformEvaluator.evaluateTransform(active as any, atTime);
    }

    return undefined;
  };

  const sortedTracks = [...tracks].sort((a, b) => a.startTime - b.startTime);
  const sceneTracks: SceneAnimationTrack[] = [];

  for (const track of sortedTracks) {
    const effectiveStart = baselineTime + track.startTime;
    const targetProperty = getTargetProperty(track.type);

    // Clone properties so we can adjust 'from' if chaining applies
    const properties = { ...(track.properties as any) } as any;

    if (properties.from === undefined || isDefaultFrom(track.type, properties.from)) {
      const inherited = getPriorValue(targetProperty, effectiveStart, track);
      if (inherited !== undefined) {
        properties.from = inherited as any;
      }
    }

    // Use the registry system to create scene transforms
    const sceneTransform = transformFactory.createSceneTransform(
      {
        id: track.id,
        type: track.type,
        startTime: track.startTime,
        duration: track.duration,
        easing: track.easing,
        properties,
      },
      objectId,
      baselineTime
    );

    sceneTracks.push({
      ...sceneTransform,
      properties,
    } as SceneAnimationTrack);
  }

  return sceneTracks;
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


