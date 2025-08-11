// src/shared/types/transforms.ts - Robust transform registry system
import type { Point2D } from './core';

// Property type definitions for validation and UI generation
export type PropertyType = 'number' | 'point2d' | 'color' | 'string' | 'boolean';

export interface PropertyDefinition {
  key: string;
  type: PropertyType;
  label: string;
  description?: string;
  defaultValue: unknown;
  required?: boolean;
  constraints?: {
    min?: number;
    max?: number;
    options?: string[];
    step?: number;
  };
}

// Transform property schemas - defines what properties each transform type needs
export type TransformProperties = Record<string, unknown>;

// Base transform definition - follows the same pattern as NodeDefinition
export interface TransformDefinition {
  type: string;
  label: string;
  description: string;
  category: 'movement' | 'appearance' | 'transformation' | 'custom';
  properties: PropertyDefinition[];
  defaults: Record<string, unknown>;
  version?: string;
  migrate?: (properties: Record<string, unknown>) => Record<string, unknown>;
  metadata?: {
    supportsEasing?: boolean;
    defaultEasing?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
    targetProperty?: string;
    trackColor?: string;
    trackIcon?: string;
    [key: string]: unknown;
  };
}

// Interpolator function signature - handles all value interpolation
export type InterpolatorFunction<T = unknown> = (from: T, to: T, progress: number) => T;

// Interpolator registry entry
export interface InterpolatorEntry<T = unknown> {
  interpolate: InterpolatorFunction<T>;
  validate: (value: unknown) => value is T;
  getEndValue: (from: T, to: T) => T;
}

// Transform registry entry - combines definition with runtime behavior
export interface TransformRegistryEntry<T extends TransformProperties = TransformProperties> {
  definition: TransformDefinition;
  interpolator: InterpolatorEntry<T>;
}

// Runtime transform instance - what gets created when users add tracks
export interface AnimationTransform {
  id: string;
  type: string;
  startTime: number;
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  properties: TransformProperties;
}

// Scene transform - what gets executed during rendering
export interface SceneTransform {
  objectId: string;
  type: string;
  startTime: number;
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  properties: TransformProperties;
}

// Transform factory interface
export interface TransformFactory {
  createTransform(type: string, properties: Record<string, unknown>): AnimationTransform;
  createSceneTransform(transform: AnimationTransform, objectId: string, baselineTime: number): SceneTransform;
  validateTransform(type: string, properties: Record<string, unknown>): boolean;
  getTransformDefinition(type: string): TransformDefinition | undefined;
  getAllTransformTypes(): string[];
  getTransformsByCategory(category: TransformDefinition['category']): TransformDefinition[];
}

// Easing function type
export type EasingFunction = (progress: number) => number;

// Easing registry
export type EasingRegistry = Record<string, EasingFunction>;

// Animation value union - what gets returned during evaluation
export type AnimationValue = Point2D | number | string | boolean | null;