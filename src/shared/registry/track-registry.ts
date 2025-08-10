// src/shared/registry/track-registry.ts
// Server-safe track registry: single source of truth for track metadata, defaults, and validation

import type { PropertySchema } from '@/shared/types/properties';
import type {
  AnimationTrack,
  MoveTrackProperties,
  RotateTrackProperties,
  ScaleTrackProperties,
  FadeTrackProperties,
  ColorTrackProperties,
} from '@/shared/types/nodes';

export interface TrackRegistryEntry<TDefaults extends Record<string, unknown> = Record<string, unknown>> {
  type: AnimationTrack['type'];
  label: string;
  description: string;
  icon: string;
  color: string;
  properties: PropertySchema[];
  defaults: TDefaults;
  execution: {
    executor: 'transform' | 'effect';
    category: 'transform' | 'effect';
  };
}

const TRACK_REGISTRY: Record<AnimationTrack['type'], TrackRegistryEntry> = {
  move: {
    type: 'move',
    label: 'Move',
    description: 'Animate position changes',
    icon: '↗️',
    color: 'bg-blue-600',
    properties: [
      { key: 'from', type: 'point2d', label: 'From', defaultValue: { x: 0, y: 0 } },
      { key: 'to', type: 'point2d', label: 'To', defaultValue: { x: 100, y: 100 } },
    ],
    defaults: { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } } satisfies MoveTrackProperties as unknown as Record<string, unknown>,
    execution: { executor: 'transform', category: 'transform' },
  },
  rotate: {
    type: 'rotate',
    label: 'Rotate',
    description: 'Animate rotation changes',
    icon: '🔄',
    color: 'bg-green-600',
    properties: [
      { key: 'rotations', type: 'number', label: 'Rotations', defaultValue: 1, step: 0.25, min: -10, max: 10 },
    ],
    defaults: { rotations: 1 } satisfies RotateTrackProperties as unknown as Record<string, unknown>,
    execution: { executor: 'transform', category: 'transform' },
  },
  scale: {
    type: 'scale',
    label: 'Scale',
    description: 'Animate scale changes',
    icon: '🔍',
    color: 'bg-yellow-600',
    properties: [
      { key: 'from', type: 'number', label: 'From', defaultValue: 1, min: 0, step: 0.05 },
      { key: 'to', type: 'number', label: 'To', defaultValue: 1.5, min: 0, step: 0.05 },
    ],
    defaults: { from: 1, to: 1.5 } satisfies ScaleTrackProperties as unknown as Record<string, unknown>,
    execution: { executor: 'transform', category: 'transform' },
  },
  fade: {
    type: 'fade',
    label: 'Fade',
    description: 'Animate opacity changes',
    icon: '◐',
    color: 'bg-gray-600',
    properties: [
      { key: 'from', type: 'number', label: 'From', defaultValue: 1, min: 0, max: 1, step: 0.05 },
      { key: 'to', type: 'number', label: 'To', defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
    ],
    defaults: { from: 1, to: 0.5 } satisfies FadeTrackProperties as unknown as Record<string, unknown>,
    execution: { executor: 'effect', category: 'effect' },
  },
  color: {
    type: 'color',
    label: 'Color',
    description: 'Animate color changes',
    icon: '🎨',
    color: 'bg-purple-600',
    properties: [
      { key: 'from', type: 'string', label: 'From', defaultValue: '#ff0000' },
      { key: 'to', type: 'string', label: 'To', defaultValue: '#00ff00' },
      { key: 'property', type: 'select', label: 'Property', options: [ { value: 'fill', label: 'Fill' }, { value: 'stroke', label: 'Stroke' } ], defaultValue: 'fill' },
    ],
    defaults: { from: '#ff0000', to: '#00ff00', property: 'fill' } satisfies ColorTrackProperties as unknown as Record<string, unknown>,
    execution: { executor: 'effect', category: 'effect' },
  },
};

export function getTrackRegistryEntry(type: AnimationTrack['type']): TrackRegistryEntry | undefined {
  return TRACK_REGISTRY[type];
}

export function validateTrackRegistry(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [trackType, entry] of Object.entries(TRACK_REGISTRY) as Array<[
    AnimationTrack['type'],
    TrackRegistryEntry
  ]>) {
    for (const property of entry.properties) {
      if (!(property.key in entry.defaults)) {
        errors.push(`Track ${trackType}: Missing default for property ${property.key}`);
      }
    }
  }
  return { isValid: errors.length === 0, errors };
}

export function getDefaultTrackPropertiesFromRegistry<T extends AnimationTrack['type']>(
  type: T
): unknown {
  const entry = getTrackRegistryEntry(type);
  return entry?.defaults;
}


