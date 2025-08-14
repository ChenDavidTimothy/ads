// src/shared/properties/granular-assignments.ts

import type { Point2D } from '@/shared/types/core';

// Granular field-level overrides using dot notation keys
export interface GranularOverrides {
  // Canvas properties
  'position.x'?: number;
  'position.y'?: number;
  'rotation'?: number;
  'scale.x'?: number;
  'scale.y'?: number;
  'opacity'?: number;
  'fillColor'?: string;
  'strokeColor'?: string;
  'strokeWidth'?: number;
  
  // Animation track properties (will be prefixed with track ID)
  // e.g., 'track.move-1.from.x', 'track.move-1.to.y'
  [key: `track.${string}.${string}`]: unknown;
  
  // Timeline properties
  'duration'?: number;
  'easing'?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  'startTime'?: number;
  
  // Generic extensible pattern for future properties
  [key: string]: unknown;
}

// Per-track override for animation timeline
export interface GranularTrackOverride {
  trackId: string;
  // All properties stored as flat dot-notation keys
  properties: GranularOverrides;
}

export interface GranularObjectAssignments {
  // Flat field-level overrides
  initial?: GranularOverrides;
  // Track-specific overrides (still needed for timeline editor)
  tracks?: GranularTrackOverride[];
}

// Map objectId -> assignments
export type GranularPerObjectAssignments = Record<string, GranularObjectAssignments>;

// Field path utilities
export class FieldPath {
  static isValid(path: string): boolean {
    // Validate dot notation paths
    return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/.test(path);
  }
  
  static parse(path: string): string[] {
    return path.split('.');
  }
  
  static join(...parts: string[]): string {
    return parts.join('.');
  }
  
  static getParent(path: string): string | null {
    const parts = this.parse(path);
    return parts.length > 1 ? this.join(...parts.slice(0, -1)) : null;
  }
  
  static getLeaf(path: string): string {
    const parts = this.parse(path);
    return parts[parts.length - 1] || path;
  }
  
  static isChildOf(childPath: string, parentPath: string): boolean {
    return childPath.startsWith(parentPath + '.');
  }
}

// Utility to check if a field is overridden
export function isFieldOverridden(overrides: GranularOverrides | undefined, fieldPath: string): boolean {
  return overrides?.[fieldPath] !== undefined;
}

// Utility to check if a field is bound
export function isFieldBound(bindings: Record<string, { boundResultNodeId?: string }> | undefined, fieldPath: string): boolean {
  return !!bindings?.[fieldPath]?.boundResultNodeId;
}

// Get effective value for a field (bound value > override value > default value)
export function getEffectiveValue<T>(
  fieldPath: string,
  overrides: GranularOverrides | undefined,
  bindings: Record<string, { boundResultNodeId?: string }> | undefined,
  boundValues: Record<string, unknown> | undefined,
  defaultValue: T
): T {
  // 1. Check if bound and has a value
  const boundNodeId = bindings?.[fieldPath]?.boundResultNodeId;
  if (boundNodeId && boundValues?.[boundNodeId] !== undefined) {
    return boundValues[boundNodeId] as T;
  }
  
  // 2. Check if overridden
  if (overrides?.[fieldPath] !== undefined) {
    return overrides[fieldPath] as T;
  }
  
  // 3. Return default
  return defaultValue;
}

// Convert legacy group-based overrides to granular overrides
export function convertLegacyToGranular(legacy: {
  position?: Point2D;
  rotation?: number;
  scale?: Point2D;
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}): GranularOverrides {
  const granular: GranularOverrides = {};
  
  if (legacy.position) {
    granular['position.x'] = legacy.position.x;
    granular['position.y'] = legacy.position.y;
  }
  if (legacy.scale) {
    granular['scale.x'] = legacy.scale.x;
    granular['scale.y'] = legacy.scale.y;
  }
  if (legacy.rotation !== undefined) granular.rotation = legacy.rotation;
  if (legacy.opacity !== undefined) granular.opacity = legacy.opacity;
  if (legacy.fillColor !== undefined) granular.fillColor = legacy.fillColor;
  if (legacy.strokeColor !== undefined) granular.strokeColor = legacy.strokeColor;
  if (legacy.strokeWidth !== undefined) granular.strokeWidth = legacy.strokeWidth;
  
  return granular;
}

// Convert granular overrides back to legacy format (for backward compatibility)
export function convertGranularToLegacy(granular: GranularOverrides): {
  position?: Point2D;
  rotation?: number;
  scale?: Point2D;
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
} {
  const legacy: any = {};
  
  if (granular['position.x'] !== undefined || granular['position.y'] !== undefined) {
    legacy.position = {
      x: granular['position.x'] ?? 0,
      y: granular['position.y'] ?? 0
    };
  }
  if (granular['scale.x'] !== undefined || granular['scale.y'] !== undefined) {
    legacy.scale = {
      x: granular['scale.x'] ?? 1,
      y: granular['scale.y'] ?? 1
    };
  }
  
  if (granular.rotation !== undefined) legacy.rotation = granular.rotation;
  if (granular.opacity !== undefined) legacy.opacity = granular.opacity;
  if (granular.fillColor !== undefined) legacy.fillColor = granular.fillColor;
  if (granular.strokeColor !== undefined) legacy.strokeColor = granular.strokeColor;
  if (granular.strokeWidth !== undefined) legacy.strokeWidth = granular.strokeWidth;
  
  return legacy;
}

// Merge granular overrides (later takes precedence)
export function mergeGranularOverrides(base: GranularOverrides | undefined, overrides: GranularOverrides | undefined): GranularOverrides {
  return { ...(base ?? {}), ...(overrides ?? {}) };
}

// Type guards
export function isGranularOverrides(value: unknown): value is GranularOverrides {
  return typeof value === 'object' && value !== null;
}

export function isGranularObjectAssignments(value: unknown): value is GranularObjectAssignments {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.initial !== undefined && !isGranularOverrides(v.initial)) return false;
  return true;
}