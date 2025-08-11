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
  lerp
} from '../core/interpolation';
type AnimationValue = Point2D | number | string | boolean | null;

// (Legacy easing and color helpers removed; modern evaluator handles interpolation)

// Evaluate a single animation track at a specific time
function evaluateAnimation(animation: SceneAnimationTrack, time: number): AnimationValue {
  // Delegate to the evaluator with absolute time so it can correctly
  // handle start/end boundaries and easing.
  return transformEvaluator.evaluateTransform(animation as any, time);
}

function getAnimationEndValue(animation: SceneAnimationTrack): AnimationValue {
  // Use the new transform evaluator for consistent end value calculation
  return transformEvaluator.getEndValue(animation);
}

// (Legacy interpolateAnimation removed)

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
  
  const objectAnimations = animations
    .filter(anim => anim.objectId === object.id)
    // Ensure chronological application so later transforms override earlier ones
    .sort((a, b) => a.startTime - b.startTime);
  
  // Track the accumulated state from completed animations
  const accumulatedState: ObjectState = {
    position: { ...object.initialPosition },
    rotation: object.initialRotation ?? 0,
    scale: object.initialScale ?? { x: 1, y: 1 },
    opacity: object.initialOpacity ?? 1,
    colors: {
      fill: object.properties.color,
      stroke: getStrokeColor(object.properties, object.type)
    }
  };
  
  for (const animation of objectAnimations) {
    const animationEndTime = animation.startTime + animation.duration;
    
    // If this animation has completed, update the accumulated state
    if (time >= animationEndTime) {
      const endValue = getAnimationEndValue(animation);
      if (endValue !== null) {
        updateAccumulatedState(accumulatedState, animation, endValue);
      }
    }
    
    // Apply the current animation value (if active) or use accumulated state
    const value = evaluateAnimation(animation, time);
    if (value !== null) {
      // For active animations, use the current value
      updateStateFromAnimation(state, animation, value);
    } else if (time >= animationEndTime) {
      // For completed animations, use the accumulated state
      updateStateFromAnimation(state, animation, accumulatedState, animation.type);
    }
  }
  
  return state;
}

// Helper function to update accumulated state with end values
function updateAccumulatedState(
  accumulatedState: ObjectState, 
  animation: SceneAnimationTrack, 
  endValue: AnimationValue
): void {
  const definition = getTransformDefinition(animation.type);
  if (!definition?.metadata?.targetProperty) return;
  
  switch (definition.metadata.targetProperty) {
    case 'position':
      accumulatedState.position = endValue as Point2D;
      break;
    case 'rotation':
      accumulatedState.rotation = endValue as number;
      break;
    case 'scale': {
      const v = endValue as number | Point2D;
      if (typeof v === 'number') {
        accumulatedState.scale = { x: v, y: v };
      } else {
        accumulatedState.scale = v;
      }
      break;
    }
    case 'opacity':
      accumulatedState.opacity = endValue as number;
      break;
    case 'color':
      const colorProperty = (animation.properties as any).property;
      if (colorProperty === 'fill') {
        accumulatedState.colors.fill = endValue as string;
      } else if (colorProperty === 'stroke') {
        accumulatedState.colors.stroke = endValue as string;
      }
      break;
  }
}

// Helper function to update state from animation value or accumulated state
function updateStateFromAnimation(
  state: ObjectState, 
  animation: SceneAnimationTrack, 
  value: AnimationValue | ObjectState,
  targetProperty?: string
): void {
  const definition = getTransformDefinition(animation.type);
  const property = targetProperty || definition?.metadata?.targetProperty;
  if (!property) return;
  
  if (typeof value === 'object' && value !== null && 'position' in value) {
    // Value is an ObjectState, extract the specific property
    switch (property) {
      case 'position':
        state.position = (value as ObjectState).position;
        break;
      case 'rotation':
        state.rotation = (value as ObjectState).rotation;
        break;
      case 'scale':
        state.scale = (value as ObjectState).scale;
        break;
      case 'opacity':
        state.opacity = (value as ObjectState).opacity;
        break;
      case 'color':
        const colorProperty = (animation.properties as any).property;
        if (colorProperty === 'fill') {
          state.colors.fill = (value as ObjectState).colors.fill;
        } else if (colorProperty === 'stroke') {
          state.colors.stroke = (value as ObjectState).colors.stroke;
        }
        break;
    }
  } else {
    // Value is a direct animation value
    switch (property) {
      case 'position':
        state.position = value as Point2D;
        break;
      case 'rotation':
        state.rotation = value as number;
        break;
      case 'scale': {
        const v = value as number | Point2D;
        if (typeof v === 'number') {
          state.scale = { x: v, y: v };
        } else {
          state.scale = v;
        }
        break;
      }
      case 'opacity':
        state.opacity = value as number;
        break;
      case 'color':
        const colorProperty = (animation.properties as any).property;
        if (colorProperty === 'fill') {
          state.colors.fill = value as string;
        } else if (colorProperty === 'stroke') {
          state.colors.stroke = value as string;
        }
        break;
    }
  }
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