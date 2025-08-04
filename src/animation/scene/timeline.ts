// src/animation/scene/timeline.ts
import type { 
  AnimationScene, 
  AnimationTrack, 
  ObjectState, 
  SceneObject,
  MoveAnimation,
  RotateAnimation,
  ScaleAnimation,
  FadeAnimation,
  ColorAnimation,
  GeometryProperties,
  TriangleProperties,
  CircleProperties,
  RectangleProperties
} from './scene';

import type { Point2D } from '../types';
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
  // Simple RGB interpolation
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
function evaluateAnimation(animation: AnimationTrack, time: number): AnimationValue {
  const animationEndTime = animation.startTime + animation.duration;
  
  // Animation hasn't started yet
  if (time < animation.startTime) {
    return null;
  }
  
  // Animation has finished
  if (time >= animationEndTime) {
    return getAnimationEndValue(animation);
  }
  
  // Animation is active - calculate progress
  const localTime = time - animation.startTime;
  const progress = localTime / animation.duration;
  const easingFunction = getEasingFunction(animation.easing);
  const easedProgress = easingFunction(progress);
  
  return interpolateAnimation(animation, easedProgress);
}

function getAnimationEndValue(animation: AnimationTrack): AnimationValue {
  switch (animation.type) {
    case 'move':
      return (animation.properties as MoveAnimation).to;
    case 'rotate':
      const rotateProps = animation.properties as RotateAnimation;
      return rotateProps.rotations 
        ? rotateProps.from + (rotateProps.rotations * Math.PI * 2)
        : rotateProps.to;
    case 'scale':
      return (animation.properties as ScaleAnimation).to;
    case 'fade':
      return (animation.properties as FadeAnimation).to;
    case 'color':
      return (animation.properties as ColorAnimation).to;
    default:
      return null;
  }
}

function interpolateAnimation(animation: AnimationTrack, progress: number): AnimationValue {
  switch (animation.type) {
    case 'move': {
      const props = animation.properties as MoveAnimation;
      return lerpPoint(props.from, props.to, progress);
    }
    
    case 'rotate': {
      const props = animation.properties as RotateAnimation;
      if (props.rotations) {
        return props.from + (progress * props.rotations * Math.PI * 2);
      }
      return lerp(props.from, props.to, progress);
    }
    
    case 'scale': {
      const props = animation.properties as ScaleAnimation;
      if (typeof props.from === 'number' && typeof props.to === 'number') {
        const scaleValue = lerp(props.from, props.to, progress);
        return { x: scaleValue, y: scaleValue };
      }
      return lerpPoint(props.from as Point2D, props.to as Point2D, progress);
    }
    
    case 'fade': {
      const props = animation.properties as FadeAnimation;
      return lerp(props.from, props.to, progress);
    }
    
    case 'color': {
      const props = animation.properties as ColorAnimation;
      return lerpColor(props.from, props.to, progress);
    }
    
    default:
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

// Get the state of an object at a specific time
export function getObjectStateAtTime(
  object: SceneObject, 
  animations: AnimationTrack[], 
  time: number
): ObjectState {
  // Start with initial object state
  const state: ObjectState = {
    position: { ...object.initialPosition },
    rotation: object.initialRotation ?? 0,
    scale: object.initialScale ?? { x: 1, y: 1 },
    opacity: object.initialOpacity ?? 1,
    colors: {
      fill: object.properties.color,
      stroke: getStrokeColor(object.properties, object.type)
    }
  };
  
  // Apply all active animations for this object
  const objectAnimations = animations.filter(anim => anim.objectId === object.id);
  
  for (const animation of objectAnimations) {
    const value = evaluateAnimation(animation, time);
    if (value === null) continue;
    
    switch (animation.type) {
      case 'move':
        state.position = value as Point2D;
        break;
      case 'rotate':
        state.rotation = value as number;
        break;
      case 'scale':
        state.scale = value as Point2D;
        break;
      case 'fade':
        state.opacity = value as number;
        break;
      case 'color':
        const colorProps = animation.properties as ColorAnimation;
        if (colorProps.property === 'fill') {
          state.colors.fill = value as string;
        } else {
          state.colors.stroke = value as string;
        }
        break;
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
): AnimationTrack {
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
): AnimationTrack {
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
): AnimationTrack {
  return {
    objectId,
    type: 'scale',
    startTime,
    duration,
    easing: easing as EasingType,
    properties: { from, to }
  };
}