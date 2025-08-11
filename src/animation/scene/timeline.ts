// src/animation/scene/timeline.ts
import type { 
  AnimationScene, 
  ObjectState, 
  SceneObject,
  GeometryProperties,
  TriangleProperties,
  CircleProperties,
  RectangleProperties
} from '@/shared/types/scene';

import type { Point2D } from '@/shared/types/core';
import type { 
  SceneAnimationTrack
} from '@/shared/types';

// Import the new registry system
import { 
  transformFactory,
  TransformEvaluator,
  getTransformDefinition
} from '@/shared/registry/transforms';

// Create an instance of the transform evaluator
const transformEvaluator = new TransformEvaluator();

import { 
  linear, 
  easeInOutCubic, 
  easeInCubic, 
  easeOutCubic,
  lerp,
  lerpPoint 
} from '../core/interpolation';

type EasingType = 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
type AnimationValue = Point2D | number | string | boolean | null;

// Get easing function by name - now using the registry system
function getEasingFunction(easing: string) {
  const easingRegistry = {
    linear,
    easeInOut: easeInOutCubic,
    easeIn: easeInCubic,
    easeOut: easeOutCubic,
  };
  return easingRegistry[easing as keyof typeof easingRegistry] || linear;
}

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

// Evaluate a single animation track at a specific time
function evaluateAnimation(animation: SceneAnimationTrack, time: number): AnimationValue {
  const animationEndTime = animation.startTime + animation.duration;
  
  if (time < animation.startTime) {
    return null;
  }
  
  if (time >= animationEndTime) {
    return getAnimationEndValue(animation);
  }
  
  const localTime = time - animation.startTime;
  const progress = localTime / animation.duration;
  
  // Use the new transform evaluator for consistent evaluation
  try {
    return transformEvaluator.evaluateTransform(animation, progress);
  } catch (error) {
    // Fallback to legacy evaluation if needed
    console.warn('Transform evaluation failed, falling back to legacy:', error);
    const easingFunction = getEasingFunction(animation.easing);
    const easedProgress = easingFunction(progress);
    return interpolateAnimation(animation, easedProgress);
  }
}

function getAnimationEndValue(animation: SceneAnimationTrack): AnimationValue {
  // Use the new transform evaluator for consistent end value calculation
  return transformEvaluator.getEndValue(animation);
}

function interpolateAnimation(animation: SceneAnimationTrack, progress: number): AnimationValue {
  // Use the new transform evaluator for consistent interpolation
  return transformEvaluator.evaluateTransform(animation, progress);
}

function getStrokeColor(properties: GeometryProperties, objectType: string): string | undefined {
  switch (objectType) {
    case 'triangle':
      return (properties as TriangleProperties).strokeColor;
    case 'circle':
      return (properties as CircleProperties).strokeColor;
    case 'rectangle':
      return (properties as RectangleProperties).strokeColor;
    default:
      return undefined;
  }
}

function evaluateVisibility(object: SceneObject, time: number): number {
  const appearanceTime = (object as unknown as { appearanceTime?: number }).appearanceTime ?? 0;
  
  if (time < appearanceTime) {
    return 0;
  }
  
  return object.initialOpacity ?? 1;
}

// Get the state of an object at a specific time
export function getObjectStateAtTime(
  object: SceneObject, 
  animations: SceneAnimationTrack[], 
  time: number
): ObjectState {
  const state: ObjectState = {
    position: { ...object.initialPosition },
    rotation: object.initialRotation ?? 0,
    scale: object.initialScale ?? { x: 1, y: 1 },
    opacity: evaluateVisibility(object, time),
    colors: {
      fill: object.properties.color,
      stroke: getStrokeColor(object.properties, object.type)
    }
  };
  
  const objectAnimations = animations.filter(anim => anim.objectId === object.id);
  
  for (const animation of objectAnimations) {
    const value = evaluateAnimation(animation, time);
    if (value === null) continue;
    
    // Use the registry system to determine how to apply the value
    const definition = getTransformDefinition(animation.type);
    if (definition?.metadata?.targetProperty) {
      // Apply the value based on the transform definition
      switch (definition.metadata.targetProperty) {
        case 'position':
          state.position = value as Point2D;
          break;
        case 'rotation':
          state.rotation = value as number;
          break;
        case 'scale':
          state.scale = value as Point2D;
          break;
        case 'opacity':
          state.opacity = value as number;
          break;
        case 'color':
          const colorProperty = (animation.properties as any).property;
          if (colorProperty === 'fill') {
            state.colors.fill = value as string;
          } else {
            state.colors.stroke = value as string;
          }
          break;
        default:
          console.warn(`Unknown target property: ${definition.metadata.targetProperty}`);
      }
    } else {
      console.warn(`No metadata found for transform type: ${animation.type}`);
    }
  }
  
  return state;
}

// Get states of all objects at a specific time
export function getSceneStateAtTime(scene: AnimationScene, time: number): Map<string, ObjectState> {
  const sceneState = new Map<string, ObjectState>();
  
  for (const object of scene.objects) {
    const objectState = getObjectStateAtTime(object, scene.animations, time);
    sceneState.set(object.id, objectState);
  }
  
  return sceneState;
}

// Helper to create common animation patterns - now using the registry system
export function createMoveAnimation(
  objectId: string,
  from: Point2D,
  to: Point2D,
  startTime: number,
  duration: number,
  easing = 'easeInOut'
): SceneAnimationTrack {
  const transform = transformFactory.createTransform('move', { from, to });
  const sceneTransform = transformFactory.createSceneTransform(transform, objectId, startTime);
  
  // Convert SceneTransform to SceneAnimationTrack
  return {
    objectId: sceneTransform.objectId,
    type: 'move' as const,
    startTime: sceneTransform.startTime,
    duration: sceneTransform.duration,
    easing: sceneTransform.easing,
    properties: {
      from: from,
      to: to
    }
  };
}

export function createRotateAnimation(
  objectId: string,
  from: number,
  to: number,
  startTime: number,
  duration: number,
  easing = 'linear'
): SceneAnimationTrack {
  const transform = transformFactory.createTransform('rotate', { from, to });
  const sceneTransform = transformFactory.createSceneTransform(transform, objectId, startTime);
  
  // Convert SceneTransform to SceneAnimationTrack
  return {
    objectId: sceneTransform.objectId,
    type: 'rotate' as const,
    startTime: sceneTransform.startTime,
    duration: sceneTransform.duration,
    easing: sceneTransform.easing,
    properties: {
      from: from,
      to: to
    }
  };
}

export function createScaleAnimation(
  objectId: string,
  from: number,
  to: number,
  startTime: number,
  duration: number,
  easing = 'easeInOut'
): SceneAnimationTrack {
  const transform = transformFactory.createTransform('scale', { from, to });
  const sceneTransform = transformFactory.createSceneTransform(transform, objectId, startTime);
  
  // Convert SceneTransform to SceneAnimationTrack
  return {
    objectId: sceneTransform.objectId,
    type: 'scale' as const,
    startTime: sceneTransform.startTime,
    duration: sceneTransform.duration,
    easing: sceneTransform.easing,
    properties: {
      from: from,
      to: to
    }
  };
}