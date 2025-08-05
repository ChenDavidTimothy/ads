// src/animation/scene/timeline.ts
import type { 
  AnimationScene, 
  ObjectState, 
  SceneObject,
  GeometryProperties,
  TriangleProperties,
  CircleProperties,
  RectangleProperties
} from './scene';

import type { Point2D } from '../types';
import type { 
  SceneAnimationTrack,
  SceneMoveTrack,
  SceneRotateTrack,
  SceneScaleTrack,
  SceneFadeTrack,
  SceneColorTrack
} from './types';

import { 
  linear, 
  easeInOutCubic, 
  easeInCubic, 
  easeOutCubic,
  lerp,
  lerpPoint 
} from '../core/interpolation';

type EasingType = 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
type AnimationValue = Point2D | number | string | null;

// Type guards for scene animation tracks
function isSceneMoveTrack(track: SceneAnimationTrack): track is SceneMoveTrack {
  return track.type === 'move';
}

function isSceneRotateTrack(track: SceneAnimationTrack): track is SceneRotateTrack {
  return track.type === 'rotate';
}

function isSceneScaleTrack(track: SceneAnimationTrack): track is SceneScaleTrack {
  return track.type === 'scale';
}

function isSceneFadeTrack(track: SceneAnimationTrack): track is SceneFadeTrack {
  return track.type === 'fade';
}

function isSceneColorTrack(track: SceneAnimationTrack): track is SceneColorTrack {
  return track.type === 'color';
}

// Get easing function by name
function getEasingFunction(easing: string) {
  switch (easing) {
    case 'linear': return linear;
    case 'easeInOut': return easeInOutCubic;
    case 'easeIn': return easeInCubic;
    case 'easeOut': return easeOutCubic;
    default: return linear;
  }
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
  const easingFunction = getEasingFunction(animation.easing);
  const easedProgress = easingFunction(progress);
  
  return interpolateAnimation(animation, easedProgress);
}

function getAnimationEndValue(animation: SceneAnimationTrack): AnimationValue {
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

function interpolateAnimation(animation: SceneAnimationTrack, progress: number): AnimationValue {
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