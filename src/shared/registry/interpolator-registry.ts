// src/shared/registry/interpolator-registry.ts - Interpolator registry system
import type { 
  InterpolatorEntry, 
  InterpolatorFunction, 
  PropertyType
} from '../types/transforms';
import type { Point2D } from '../types/core';
import { 
  linear, 
  easeInOutCubic, 
  easeInCubic, 
  easeOutCubic,
  lerp,
  lerpPoint 
} from '../../animation/core/interpolation';

// Color interpolation helper
function lerpColor(startColor: string, endColor: string, t: number): string {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  
  if (!start || !end) return startColor;
  
  const r = Math.round(lerp(start.r, end.r, t));
  const g = Math.round(lerp(start.g, end.g, t));
  const b = Math.round(lerp(start.b, end.b, t));
  
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16)
  } : null;
}

// Number interpolator
const numberInterpolator: InterpolatorEntry<number> = {
  interpolate: (from: number, to: number, progress: number): number => {
    return lerp(from, to, progress);
  },
  validate: (value: unknown): value is number => {
    return typeof value === 'number' && !isNaN(value);
  },
  getEndValue: (from: number, to: number): number => {
    return to;
  },
};

// Point2D interpolator
const point2dInterpolator: InterpolatorEntry<Point2D> = {
  interpolate: (from: Point2D, to: Point2D, progress: number): Point2D => {
    return lerpPoint(from, to, progress);
  },
  validate: (value: unknown): value is Point2D => {
    if (typeof value !== 'object' || value === null) return false;
    const point = value as Record<string, unknown>;
    return typeof point.x === 'number' && typeof point.y === 'number';
  },
  getEndValue: (from: Point2D, to: Point2D): Point2D => {
    return to;
  },
};

// Color interpolator
const colorInterpolator: InterpolatorEntry<string> = {
  interpolate: (from: string, to: string, progress: number): string => {
    return lerpColor(from, to, progress);
  },
  validate: (value: unknown): value is string => {
    return typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb'));
  },
  getEndValue: (from: string, to: string): string => {
    return to;
  },
};

// String interpolator (discrete - no interpolation, just returns end value)
const stringInterpolator: InterpolatorEntry<string> = {
  interpolate: (from: string, to: string, progress: number): string => {
    // For strings, we could implement discrete interpolation based on progress
    // For now, just return the end value when progress reaches threshold
    return progress >= 0.5 ? to : from;
  },
  validate: (value: unknown): value is string => {
    return typeof value === 'string';
  },
  getEndValue: (from: string, to: string): string => {
    return to;
  },
};

// Boolean interpolator (discrete - no interpolation, just returns end value)
const booleanInterpolator: InterpolatorEntry<boolean> = {
  interpolate: (from: boolean, to: boolean, progress: number): boolean => {
    // For booleans, we could implement discrete interpolation based on progress
    // For now, just return the end value when progress reaches threshold
    return progress >= 0.5 ? to : from;
  },
  validate: (value: unknown): value is boolean => {
    return typeof value === 'boolean';
  },
  getEndValue: (from: boolean, to: boolean): boolean => {
    return to;
  },
};

// Interpolator registry - maps property types to their interpolators
export const INTERPOLATOR_REGISTRY: Record<PropertyType, InterpolatorEntry<unknown>> = {
  number: numberInterpolator as InterpolatorEntry<unknown>,
  point2d: point2dInterpolator as InterpolatorEntry<unknown>,
  color: colorInterpolator as InterpolatorEntry<unknown>,
  string: stringInterpolator as InterpolatorEntry<unknown>,
  boolean: booleanInterpolator as InterpolatorEntry<unknown>,
};

// Get interpolator for a property type
export function getInterpolator(propertyType: PropertyType): InterpolatorEntry {
  return INTERPOLATOR_REGISTRY[propertyType];
}

// Get interpolator for a value (auto-detect type)
export function getInterpolatorForValue(value: unknown): InterpolatorEntry | null {
  for (const [type, interpolator] of Object.entries(INTERPOLATOR_REGISTRY)) {
    if (interpolator.validate(value)) {
      return interpolator;
    }
  }
  return null;
}

// Validate if a value can be interpolated
export function canInterpolate(value: unknown): boolean {
  return getInterpolatorForValue(value) !== null;
}

// Get all supported property types
export function getSupportedPropertyTypes(): PropertyType[] {
  return Object.keys(INTERPOLATOR_REGISTRY) as PropertyType[];
}