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
  SceneAnimationTrack,
  SceneMoveTrack,
  SceneRotateTrack,
  SceneScaleTrack,
  SceneFadeTrack,
  SceneColorTrack
} from '@/shared/types';

// Import the new registry system
import { 
  transformFactory,
  TransformEvaluator,
  getTransformDefinition,
  getDefaultProperties
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

// Type guards for scene animation tracks - now using the registry system
// These are now generated dynamically from the registry
import { 
  isSceneMoveTrack,
  isSceneRotateTrack,
  isSceneScaleTrack,
  isSceneFadeTrack,
  isSceneColorTrack
} from '@/shared/types/scene';

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
  try {
    return transformEvaluator.getEndValue(animation);
  } catch (error) {
    // Fallback to legacy evaluation if needed
    console.warn('Transform end value calculation failed, falling back to legacy:', error);
    if (isSceneMoveTrack(animation)) {
      return animation.properties.to;
    } else if (isSceneRotateTrack(animation)) {
      return animation.properties.rotations 
        ? animation.properties.from + (animation.properties.rotations * Math.PI * 2)
        : animation.properties.to;
    } else if (isSceneScaleTrack(animation)) {
      return animation.properties.to;
    } else if (isSceneFadeTrack(animation)) {
      return animation.properties.to;
    } else if (isSceneColorTrack(animation)) {
      return animation.properties.to;
    }
    return null;
  }
}

function interpolateAnimation(animation: SceneAnimationTrack, progress: number): AnimationValue {
  // Use the new transform evaluator for consistent interpolation
  try {
    return transformEvaluator.evaluateTransform(animation, progress);
  } catch (error) {
    // Fallback to legacy interpolation if needed
    console.warn('Transform interpolation failed, falling back to legacy:', error);
  if (isSceneMoveTrack(animation)) {
    return lerpPoint(animation.properties.from, animation.properties.to, progress);
  } else if (isSceneRotateTrack(animation)) {
    if (animation.properties.rotations) {
      return animation.properties.from + (progress * animation.properties.rotations * Math.PI * 2);
    }
    return lerp(animation.properties.from, animation.properties.to, progress);
  } else if (isSceneScaleTrack(animation)) {
    if (typeof animation.properties.from === 'number' && typeof animation.properties.to === 'number') {
      const scaleValue = lerp(animation.properties.from, animation.properties.to, progress);
      return { x: scaleValue, y: scaleValue };
    }
    return lerpPoint(animation.properties.from as Point2D, animation.properties.to as Point2D, progress);
  } else if (isSceneFadeTrack(animation)) {
    return lerp(animation.properties.from, animation.properties.to, progress);
  } else if (isSceneColorTrack(animation)) {
    return lerpColor(animation.properties.from, animation.properties.to, progress);
  }
  return null;
  }
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
    if (definition?.metadata) {
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
          // Fallback to legacy type checking
          if (isSceneMoveTrack(animation)) {
            state.position = value as Point2D;
          } else if (isSceneRotateTrack(animation)) {
            state.rotation = value as number;
          } else if (isSceneScaleTrack(animation)) {
            state.scale = value as Point2D;
          } else if (isSceneFadeTrack(animation)) {
            state.opacity = value as number;
          } else if (isSceneColorTrack(animation)) {
            if (animation.properties.property === 'fill') {
              state.colors.fill = value as string;
            } else {
              state.colors.stroke = value as string;
            }
          }
      }
    } else {
      // Fallback to legacy type checking if no definition found
      if (isSceneMoveTrack(animation)) {
        state.position = value as Point2D;
      } else if (isSceneRotateTrack(animation)) {
        state.rotation = value as number;
      } else if (isSceneScaleTrack(animation)) {
        state.scale = value as Point2D;
      } else if (isSceneFadeTrack(animation)) {
        state.opacity = value as number;
      } else if (isSceneColorTrack(animation)) {
        if (animation.properties.property === 'fill') {
          state.colors.fill = value as string;
        } else {
          state.colors.stroke = value as string;
        }
      }
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

// Helper to create common animation patterns
export function createMoveAnimation(
  objectId: string,
  from: Point2D,
  to: Point2D,
  startTime: number,
  duration: number,
  easing = 'easeInOut'
): SceneMoveTrack {
  return {
    objectId,
    type: 'move',
    startTime,
    duration,
    easing: easing as EasingType,
    properties: { from, to }
  };
}

export function createRotateAnimation(
  objectId: string,
  rotations: number,
  startTime: number,
  duration: number,
  easing = 'linear'
): SceneRotateTrack {
  return {
    objectId,
    type: 'rotate',
    startTime,
    duration,
    easing: easing as EasingType,
    properties: { from: 0, to: 0, rotations }
  };
}

export function createScaleAnimation(
  objectId: string,
  from: number,
  to: number,
  startTime: number,
  duration: number,
  easing = 'easeInOut'
): SceneScaleTrack {
  return {
    objectId,
    type: 'scale',
    startTime,
    duration,
    easing: easing as EasingType,
    properties: { from, to }
  };
}