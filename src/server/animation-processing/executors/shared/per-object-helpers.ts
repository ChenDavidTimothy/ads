import type { SceneAnimationTrack } from '@/shared/types';
import type { PerObjectAssignments } from '@/shared/properties/assignments';
import { mergeObjectAssignments } from '@/shared/properties/assignments';
import type { ExecutionValue } from '../../execution-context';
import { mergeCursorMaps } from '../../scene/scene-assembler';
import { deepClone } from './common';

export function clonePerObjectAnimations(
  map: Record<string, SceneAnimationTrack[]>
): Record<string, SceneAnimationTrack[]> {
  const cloned: Record<string, SceneAnimationTrack[]> = {};
  for (const [k, v] of Object.entries(map)) {
    cloned[k] = v.map((t) => ({
      ...t,
      properties: deepClone(t.properties),
    })) as SceneAnimationTrack[];
  }
  return cloned;
}

export function extractPerObjectAnimationsFromInputs(
  inputs: ExecutionValue[]
): Record<string, SceneAnimationTrack[]> {
  const merged: Record<string, SceneAnimationTrack[]> = {};
  for (const input of inputs) {
    const perObj = (
      input.metadata as { perObjectAnimations?: Record<string, SceneAnimationTrack[]> } | undefined
    )?.perObjectAnimations;
    if (!perObj) continue;
    for (const [objectId, tracks] of Object.entries(perObj)) {
      const list = merged[objectId] ?? [];
      merged[objectId] = [...list, ...tracks];
    }
  }
  return merged;
}

export function extractCursorsFromInputs(inputs: ExecutionValue[]): Record<string, number> {
  const maps: Record<string, number>[] = [];
  for (const input of inputs) {
    const cursors = (input.metadata as { perObjectTimeCursor?: Record<string, number> } | undefined)
      ?.perObjectTimeCursor;
    if (cursors) maps.push(cursors);
  }
  if (maps.length === 0) return {};
  return mergeCursorMaps(maps);
}

export function extractPerObjectAssignmentsFromInputs(
  inputs: ExecutionValue[]
): PerObjectAssignments | undefined {
  const merged: PerObjectAssignments = {};
  let found = false;
  for (const input of inputs) {
    const fromMeta = (input.metadata as { perObjectAssignments?: PerObjectAssignments } | undefined)
      ?.perObjectAssignments;
    if (!fromMeta) continue;
    for (const [objectId, assignment] of Object.entries(fromMeta)) {
      found = true;
      const base = merged[objectId];
      const combined = mergeObjectAssignments(base, assignment);
      if (combined) merged[objectId] = combined;
    }
  }
  return found ? merged : undefined;
}

export function extractPerObjectBatchOverridesFromInputs(
  inputs: ExecutionValue[]
): Record<string, Record<string, Record<string, unknown>>> | undefined {
  const merged: Record<string, Record<string, Record<string, unknown>>> = {};
  let found = false;
  for (const input of inputs) {
    const fromMeta = (
      input.metadata as
        | {
            perObjectBatchOverrides?: Record<string, Record<string, Record<string, unknown>>>;
          }
        | undefined
    )?.perObjectBatchOverrides;
    if (!fromMeta) continue;
    for (const [objectId, batchOverrides] of Object.entries(fromMeta)) {
      found = true;
      merged[objectId] = { ...merged[objectId], ...batchOverrides };
    }
  }
  return found ? merged : undefined;
}
