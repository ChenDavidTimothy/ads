import type { SceneAnimationTrack } from '@/shared/types/scene';
import type { PerObjectAssignments } from '@/shared/properties/assignments';
import { mergeObjectAssignments, isObjectAssignments } from '@/shared/properties/assignments';

type ExecutionMetadata = {
  perObjectTimeCursor?: Record<string, number>;
  perObjectAnimations?: Record<string, SceneAnimationTrack[]>;
  perObjectAssignments?: PerObjectAssignments;
} & Record<string, unknown>;

function isExecutionMetadata(value: unknown): value is ExecutionMetadata {
  return Boolean(value && typeof value === 'object');
}

function toSceneAnimationTrackArray(value: unknown): SceneAnimationTrack[] {
  if (!Array.isArray(value)) return [];
  return value.filter((track): track is SceneAnimationTrack => {
    if (!track || typeof track !== 'object') return false;
    const maybe = track as { type?: unknown };
    return typeof maybe.type === 'string';
  });
}

export function extractCursorsFromInputs(
  inputs: Array<{ metadata?: unknown }>
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const { metadata } of inputs) {
    if (!isExecutionMetadata(metadata)) continue;
    const cursorMap = metadata.perObjectTimeCursor;
    if (!cursorMap || typeof cursorMap !== 'object') continue;
    let valid = true;
    for (const value of Object.values(cursorMap)) {
      if (typeof value !== 'number') {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    for (const [objectId, time] of Object.entries(cursorMap)) {
      const existing = merged[objectId];
      const nextTime = typeof existing === 'number' && existing > time ? existing : time;
      merged[objectId] = nextTime;
    }
  }
  return merged;
}

export function extractPerObjectAnimationsFromInputs(
  inputs: Array<{ metadata?: unknown }>,
  allowIds: string[]
): Record<string, SceneAnimationTrack[]> {
  const merged: Record<string, SceneAnimationTrack[]> = {};
  for (const { metadata } of inputs) {
    if (!isExecutionMetadata(metadata)) continue;
    const fromMeta = metadata.perObjectAnimations;
    if (!fromMeta || typeof fromMeta !== 'object') continue;
    for (const [objectId, animations] of Object.entries(fromMeta)) {
      if (!allowIds.includes(objectId)) continue;
      const typedAnimations = toSceneAnimationTrackArray(animations);
      if (typedAnimations.length === 0) continue;
      merged[objectId] = [...(merged[objectId] ?? []), ...typedAnimations];
    }
  }
  return merged;
}

export function extractPerObjectAnimationsFromInputsWithPriority(
  portInputs: Array<Array<{ metadata?: unknown } | undefined>>,
  allowIds: string[]
): Record<string, SceneAnimationTrack[]> {
  const merged: Record<string, SceneAnimationTrack[]> = {};

  for (let portIndex = portInputs.length - 1; portIndex >= 0; portIndex--) {
    const inputs = portInputs[portIndex];
    if (!inputs) continue;

    for (const input of inputs) {
      const { metadata } = input ?? {};
      if (!isExecutionMetadata(metadata)) continue;
      const fromMeta = metadata.perObjectAnimations;
      if (!fromMeta || typeof fromMeta !== 'object') continue;

      for (const [objectId, animations] of Object.entries(fromMeta)) {
        if (!allowIds.includes(objectId)) continue;

        const typedAnimations = toSceneAnimationTrackArray(animations);
        if (typedAnimations.length === 0) continue;
        const clonedAnimations = typedAnimations.map((anim) => {
          switch (anim.type) {
            case 'move':
            case 'rotate':
            case 'scale':
            case 'fade':
            case 'color':
              return {
                ...anim,
                properties: { ...anim.properties },
              } as SceneAnimationTrack;
            default:
              return anim as SceneAnimationTrack;
          }
        });

        const existingAnimations = merged[objectId] ?? [];
        const newAnimations: SceneAnimationTrack[] = [];

        for (const newAnim of clonedAnimations) {
          const conflictingAnimations = existingAnimations.filter(
            (existingAnim) => existingAnim.type === newAnim.type
          );

          if (conflictingAnimations.length === 0) {
            newAnimations.push(newAnim);
          } else {
            newAnimations.push(newAnim);
          }
        }

        const currentAnimations = merged[objectId] ?? [];
        const nonConflictingExisting = currentAnimations.filter(
          (existingAnim) => !newAnimations.some((newAnim) => newAnim.type === existingAnim.type)
        );
        merged[objectId] = [...nonConflictingExisting, ...newAnimations];
      }
    }
  }

  return merged;
}

export function extractPerObjectAssignmentsFromInputs(
  inputs: Array<{ metadata?: unknown }>,
  allowIds: string[]
): PerObjectAssignments {
  const merged: PerObjectAssignments = {};
  for (const { metadata } of inputs) {
    if (!isExecutionMetadata(metadata)) continue;
    const fromMeta = metadata.perObjectAssignments;
    if (!fromMeta || typeof fromMeta !== 'object') continue;
    for (const [objectId, assignment] of Object.entries(fromMeta)) {
      if (!allowIds.includes(objectId)) continue;
      const base = merged[objectId];
      if (!isObjectAssignments(assignment)) continue;
      const combined = mergeObjectAssignments(base, assignment);
      if (combined) merged[objectId] = combined;
    }
  }
  return merged;
}

export function extractPerObjectAssignmentsFromInputsWithPriority(
  portInputs: Array<Array<{ metadata?: unknown } | undefined>>,
  allowIds: string[]
): PerObjectAssignments {
  const merged: PerObjectAssignments = {};
  for (let portIndex = portInputs.length - 1; portIndex >= 0; portIndex--) {
    const inputs = portInputs[portIndex];
    if (!inputs) continue;
    for (const input of inputs) {
      const { metadata } = input ?? {};
      if (!isExecutionMetadata(metadata)) continue;
      const fromMeta = metadata.perObjectAssignments;
      if (!fromMeta || typeof fromMeta !== 'object') continue;
      for (const [objectId, assignment] of Object.entries(fromMeta)) {
        if (!allowIds.includes(objectId)) continue;
        const base = merged[objectId];
        if (!isObjectAssignments(assignment)) continue;
        const combined = mergeObjectAssignments(base, assignment);
        if (combined) merged[objectId] = combined;
      }
    }
  }
  return merged;
}
