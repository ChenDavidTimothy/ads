// src/server/animation-processing/scene/scene-assembler.ts
import type { AnimationTrack, SceneAnimationTrack } from "@/shared/types";

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

export function convertTracksToSceneAnimations(tracks: AnimationTrack[], objectId: string, baselineTime: number): SceneAnimationTrack[] {
  return tracks.map((track): SceneAnimationTrack => {
    switch (track.type) {
      case 'move':
        return {
          objectId,
          type: 'move',
          startTime: baselineTime + track.startTime,
          duration: track.duration,
          easing: track.easing,
          properties: {
            from: track.properties.from,
            to: track.properties.to,
          }
        };
      case 'rotate':
        return {
          objectId,
          type: 'rotate',
          startTime: baselineTime + track.startTime,
          duration: track.duration,
          easing: track.easing,
          properties: {
            from: 0,
            to: 0,
            rotations: track.properties.rotations,
          }
        };
      case 'scale':
        return {
          objectId,
          type: 'scale',
          startTime: baselineTime + track.startTime,
          duration: track.duration,
          easing: track.easing,
          properties: {
            from: track.properties.from,
            to: track.properties.to,
          }
        };
      case 'fade':
        return {
          objectId,
          type: 'fade',
          startTime: baselineTime + track.startTime,
          duration: track.duration,
          easing: track.easing,
          properties: {
            from: track.properties.from,
            to: track.properties.to,
          }
        };
      case 'color':
        return {
          objectId,
          type: 'color',
          startTime: baselineTime + track.startTime,
          duration: track.duration,
          easing: track.easing,
          properties: {
            from: track.properties.from,
            to: track.properties.to,
            property: track.properties.property,
          }
        };
      default:
        // Exhaustiveness check: if a new track type is added, TypeScript will flag this switch as non-exhaustive.
        // We deliberately throw here to fail fast in runtime as well.
        throw new Error('Unknown track type');
    }
  });
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


