// src/lib/defaults/transforms.ts - Identifier and defaults utilities for transforms
import { transformFactory } from '@/shared/registry/transforms';
import type { TransformIdentifier } from '@/shared/types/transforms';
import type { AnimationTrack } from '@/shared/types/nodes';

// Map transform types to short prefixes (keep in sync with registry)
function getTransformShortId(transformType: string): string {
  const prefixes: Record<string, string> = {
    move: 'mov',
    rotate: 'rot',
    scale: 'scl',
    fade: 'fad',
    color: 'col',
  };

  // Add null safety check
  if (!transformType || typeof transformType !== 'string') {
    console.warn('getTransformShortId called with invalid transformType:', transformType);
    return 'unk';
  }

  return prefixes[transformType] ?? transformType.slice(0, 3);
}

export function getTransformDisplayLabel(transformType: string): string {
  const def = transformFactory.getTransformDefinition(transformType);
  return def?.label ?? 'Unknown Transform';
}

function generateUniqueTransformDisplayName(
  transformType: string,
  existingTracks: AnimationTrack[]
): string {
  const baseName = getTransformDisplayLabel(transformType);
  const existingNames = new Set(
    existingTracks
      .map((t) => (t as unknown as { identifier?: TransformIdentifier }).identifier?.displayName)
      .filter((n): n is string => typeof n === 'string')
      .map((n) => n.toLowerCase())
  );

  let counter = 1;
  let candidate = `${baseName} ${counter}`;
  while (existingNames.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${baseName} ${counter}`;
  }
  return candidate;
}

export function generateTransformIdentifier(
  transformType: string,
  existingTracks: AnimationTrack[]
): TransformIdentifier {
  const year = new Date().getFullYear();
  const shortId = getTransformShortId(transformType);
  const sameTypeCount = existingTracks.filter((t) => t.type === transformType).length;
  const sequence = sameTypeCount + 1;
  const suffix = Math.random().toString(36).slice(2, 10);
  const id = `${shortId}_${year}_${sequence.toString().padStart(3, '0')}_${suffix}`;
  const displayName = generateUniqueTransformDisplayName(transformType, existingTracks);
  return {
    id,
    type: transformType,
    createdAt: Date.now(),
    sequence,
    displayName,
  };
}

export function validateTransformDisplayName(
  newName: string,
  currentTrackId: string,
  allTracks: AnimationTrack[]
): string | null {
  const trimmed = newName.trim();
  if (!trimmed) return 'Transform name cannot be empty';
  const conflict = allTracks.find((t) => {
    const identifier = (t as unknown as { identifier: TransformIdentifier }).identifier;
    if (identifier.id === currentTrackId) return false;
    return identifier.displayName.toLowerCase() === trimmed.toLowerCase();
  });
  return conflict ? 'A transform with this name already exists' : null;
}
