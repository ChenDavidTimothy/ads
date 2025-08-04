// src/animation/scene/scene.ts
import type { Point2D } from '../types';


export interface AnimationScene {
  duration: number;
  objects: SceneObject[];
  animations: AnimationTrack[];
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


export interface AnimationTrack {
  objectId: string;
  type: 'move' | 'rotate' | 'scale' | 'fade' | 'color';
  startTime: number;
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  properties: AnimationProperties;
}

export interface MoveAnimation {
  from: Point2D;
  to: Point2D;
}

export interface RotateAnimation {
  from: number;
  to: number;
  rotations?: number; // For multiple full rotations
}

export interface ScaleAnimation {
  from: Point2D | number; // number for uniform scale
  to: Point2D | number;
}

export interface FadeAnimation {
  from: number; // 0-1 opacity
  to: number;
}

export interface ColorAnimation {
  from: string;
  to: string;
  property: 'fill' | 'stroke';
}

export type AnimationProperties = 
  | MoveAnimation 
  | RotateAnimation 
  | ScaleAnimation 
  | FadeAnimation 
  | ColorAnimation;

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