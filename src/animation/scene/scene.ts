// src/animation/scene/scene.ts
import type { Point2D } from '../types';
import type { SceneAnimationTrack } from './types';

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
  type: 'triangle' | 'circle' | 'rectangle';
  properties: GeometryProperties;
  initialPosition: Point2D;
  initialRotation?: number;
  initialScale?: Point2D;
  initialOpacity?: number;
}

export interface TriangleProperties {
  size: number;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface CircleProperties {
  radius: number;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface RectangleProperties {
  width: number;
  height: number;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export type GeometryProperties = TriangleProperties | CircleProperties | RectangleProperties;

// Object state at any point in time
export interface ObjectState {
  position: Point2D;
  rotation: number;
  scale: Point2D;
  opacity: number;
  colors: {
    fill: string;
    stroke?: string;
  };
}

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