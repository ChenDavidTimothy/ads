// src/shared/types/scene.ts
import type { Point2D } from './core';
import type { PropertySourceMap } from '@/shared/properties/precedence';

// Animation Scene
export interface AnimationScene {
  duration: number;
  objects: SceneObject[];
  animations: SceneAnimationTrack[];
  background?: {
    color: string;
  };
}

export interface SceneObject {
  id: string;
  type: 'triangle' | 'circle' | 'rectangle' | 'text';
  properties: GeometryProperties;
  initialPosition: Point2D;
  initialRotation?: number;
  initialScale?: Point2D;
  initialOpacity?: number;
  // ✅ ADD - Following existing pattern
  initialFillColor?: string;
  initialStrokeColor?: string;
  initialStrokeWidth?: number;
  // Store text styling directly (not in metadata)
  textStyle?: {
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  };
}

export interface TriangleProperties {
  size: number;
}

export interface CircleProperties {
  radius: number;
}

export interface RectangleProperties {
  width: number;
  height: number;
}

export interface TextProperties {
  content: string;
  fontSize: number;
}

export type GeometryProperties = TriangleProperties | CircleProperties | RectangleProperties | TextProperties;

// Object state at any point in time
export interface ObjectState {
  position: Point2D;
  rotation: number;
  scale: Point2D;
  opacity: number;
  colors: {
    fill: string;
    stroke: string;
  };
  strokeWidth: number;
  // Optional source tracking to support assignment precedence and debugging
  _sources?: PropertySourceMap;
}

// Scene-specific animation track types (with objectId for execution)
// Now using the registry system for extensibility
export interface BaseSceneAnimationTrack {
  id: string;
  objectId: string;
  startTime: number;
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
}

// Individual scene track types - now generated from registry
export interface SceneMoveTrack extends BaseSceneAnimationTrack {
  type: 'move';
  properties: {
    from: Point2D;
    to: Point2D;
  };
}

export interface SceneRotateTrack extends BaseSceneAnimationTrack {
  type: 'rotate';
  properties: {
    from: number;
    to: number;
  };
}

export interface SceneScaleTrack extends BaseSceneAnimationTrack {
  type: 'scale';
  properties: {
    from: number | Point2D;
    to: number | Point2D;
  };
}

export interface SceneFadeTrack extends BaseSceneAnimationTrack {
  type: 'fade';
  properties: {
    from: number;
    to: number;
  };
}

export interface SceneColorTrack extends BaseSceneAnimationTrack {
  type: 'color';
  properties: {
    from: string;
    to: string;
    property: 'fill' | 'stroke';
  };
}

// Union type - now extensible through registry
export type SceneAnimationTrack = 
  | SceneMoveTrack 
  | SceneRotateTrack 
  | SceneScaleTrack 
  | SceneFadeTrack 
  | SceneColorTrack;

// Type guard factory - generates type guards dynamically
export function createSceneTrackTypeGuard<T extends SceneAnimationTrack>(type: T['type']) {
  return (track: SceneAnimationTrack): track is T => track.type === type;
}

// Pre-generated type guards for existing types
export const isSceneMoveTrack = createSceneTrackTypeGuard<SceneMoveTrack>('move');
export const isSceneRotateTrack = createSceneTrackTypeGuard<SceneRotateTrack>('rotate');
export const isSceneScaleTrack = createSceneTrackTypeGuard<SceneScaleTrack>('scale');
export const isSceneFadeTrack = createSceneTrackTypeGuard<SceneFadeTrack>('fade');
export const isSceneColorTrack = createSceneTrackTypeGuard<SceneColorTrack>('color');

// Validation helpers
export function validateScene(scene: AnimationScene): string[] {
  const errors: string[] = [];
  
  if (scene.duration <= 0) {
    errors.push("Scene duration must be positive");
  }
  
  if (scene.objects.length === 0) {
    errors.push("Scene must contain at least one object");
  }
  
  const objectIds = new Set(scene.objects.map(obj => obj.id));
  
  for (const animation of scene.animations) {
    if (!objectIds.has(animation.objectId)) {
      errors.push(`Animation references unknown object: ${animation.objectId}`);
    }
    
    if (animation.startTime < 0) {
      errors.push(`Animation start time cannot be negative: ${animation.objectId}`);
    }
    
    if (animation.startTime + animation.duration > scene.duration) {
      errors.push(`Animation extends beyond scene duration: ${animation.objectId}`);
    }
  }
  
  return errors;
}