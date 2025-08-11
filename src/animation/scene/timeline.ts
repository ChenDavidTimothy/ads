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