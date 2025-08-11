// src/server/animation-processing/scene/scene-assembler.ts
import type { AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import { transformFactory } from "@/shared/registry/transforms";

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
    // Use the registry system to create scene transforms
    const sceneTransform = transformFactory.createSceneTransform(
      {
        id: track.id,
        type: track.type,
        startTime: track.startTime,
        duration: track.duration,
        easing: track.easing,
        properties: track.properties as any,
      },
      objectId,
      baselineTime
    );
    
    // Convert SceneTransform to SceneAnimationTrack
    return {
      ...sceneTransform,
      properties: track.properties as any,
    } as SceneAnimationTrack;
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


