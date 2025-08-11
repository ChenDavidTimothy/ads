// src/shared/registry/transform-evaluator.ts - Transform evaluator system
import type { 
  SceneTransform, 
  AnimationValue
} from '../types/transforms';
import type { Point2D } from '../types/core';
import { transformFactory } from './transform-factory';
import { getInterpolator } from './interpolator-registry';
import { 
  linear, 
  easeInOutCubic, 
  easeInCubic, 
  easeOutCubic 
} from '../../animation/core/interpolation';

// Easing function registry
const EASING_REGISTRY = {
  linear,
  easeInOut: easeInOutCubic,
  easeIn: easeInCubic,
  easeOut: easeOutCubic,
};

// Get easing function by name
function getEasingFunction(easing: string) {
  return EASING_REGISTRY[easing as keyof typeof EASING_REGISTRY] ?? linear;
}

// Transform evaluator class
export class TransformEvaluator {
  
  // Evaluate a transform at a specific time
  evaluateTransform(
    transform: SceneTransform, 
    time: number
  ): AnimationValue {
    const animationEndTime = transform.startTime + transform.duration;
    
    // Before animation starts
    if (time < transform.startTime) {
      return null;
    }
    
    // After animation ends
    if (time >= animationEndTime) {
      return this.getEndValue(transform);
    }
    
    // During animation
    const localTime = time - transform.startTime;
    const progress = localTime / transform.duration;
    const easingFunction = getEasingFunction(transform.easing);
    const easedProgress = easingFunction(progress);
    
    return this.interpolateTransform(transform, easedProgress);
  }

  // Get the end value of a transform
  public getEndValue(transform: SceneTransform): AnimationValue {
    const definition = transformFactory.getTransformDefinition(transform.type);
    if (!definition) {
      return null;
    }

    // For most transforms, we need to determine the end value based on the transform type
    switch (transform.type) {
      case 'move':
        return transform.properties.to as Point2D;
      case 'rotate':
        // For rotate, we need to calculate the final rotation
        const toRotation = transform.properties.to as number;
        return toRotation;
      case 'scale':
        return transform.properties.to as number;
      case 'fade':
        return transform.properties.to as number;
      case 'color':
        return transform.properties.to as string;
      default:
        // For unknown transforms, try to get the end value from properties
        return transform.properties.to as AnimationValue;
    }
  }

  // Interpolate a transform at a specific progress
  private interpolateTransform(transform: SceneTransform, progress: number): AnimationValue {
    const definition = transformFactory.getTransformDefinition(transform.type);
    if (!definition) {
      return null;
    }

    // Handle each transform type using the registry system
    switch (transform.type) {
      case 'move':
        return this.interpolateMove(transform, progress);
      case 'rotate':
        return this.interpolateRotate(transform, progress);
      case 'scale':
        return this.interpolateScale(transform, progress);
      case 'fade':
        return this.interpolateFade(transform, progress);
      case 'color':
        return this.interpolateColor(transform, progress);
      default:
        return this.interpolateGeneric(transform, progress);
    }
  }

  // Interpolate move transform
  private interpolateMove(transform: SceneTransform, progress: number): Point2D {
    const from = transform.properties.from as Point2D;
    const to = transform.properties.to as Point2D;
    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    };
  }

  // Interpolate rotate transform
  private interpolateRotate(transform: SceneTransform, progress: number): number {
    const from = transform.properties.from as number;
    const to = transform.properties.to as number;
    return from + (to - from) * progress;
  }

  // Interpolate scale transform
  private interpolateScale(transform: SceneTransform, progress: number): number {
    const from = transform.properties.from as number;
    const to = transform.properties.to as number;
    return from + (to - from) * progress;
  }

  // Interpolate fade transform
  private interpolateFade(transform: SceneTransform, progress: number): number {
    const from = transform.properties.from as number;
    const to = transform.properties.to as number;
    return from + (to - from) * progress;
  }

  // Interpolate color transform
  private interpolateColor(transform: SceneTransform, progress: number): string {
    const from = transform.properties.from as string;
    const to = transform.properties.to as string;
    const interpolator = getInterpolator('color');
    if (interpolator) {
      return interpolator.interpolate(from, to, progress) as string;
    }
    return to;
  }

  // Generic interpolation for unknown transform types
  private interpolateGeneric(transform: SceneTransform, progress: number): AnimationValue {
    const definition = transformFactory.getTransformDefinition(transform.type);
    if (!definition) {
      return null;
    }

    // Try to find properties that can be interpolated
    for (const propDef of definition.properties) {
      const from = transform.properties[propDef.key];
      const to = transform.properties[`to_${propDef.key}`] ?? transform.properties[propDef.key];
      
      if (from !== undefined && to !== undefined && from !== to) {
        const interpolator = getInterpolator(propDef.type);
        if (interpolator) {
          return interpolator.interpolate(from, to, progress) as AnimationValue;
        }
      }
    }

    return null;
  }

  // Evaluate multiple transforms for an object
  evaluateObjectTransforms(
    transforms: SceneTransform[], 
    time: number
  ): Map<string, AnimationValue> {
    const results = new Map<string, AnimationValue>();
    
    for (const transform of transforms) {
      const value = this.evaluateTransform(transform, time);
      if (value !== null) {
        results.set(transform.type, value);
      }
    }
    
    return results;
  }

  // Get the final accumulated state for an object at a specific time
  getAccumulatedObjectState(
    transforms: SceneTransform[], 
    time: number,
    initialState: { position?: Point2D; rotation?: number; scale?: Point2D; opacity?: number }
  ): Map<string, AnimationValue> {
    const results = new Map<string, AnimationValue>();
    
    // Sort transforms by start time to ensure proper order
    const sortedTransforms = [...transforms].sort((a, b) => a.startTime - b.startTime);
    
    // Track accumulated values
    const accumulated: Record<string, AnimationValue> = {
      position: initialState.position ?? { x: 0, y: 0 },
      rotation: initialState.rotation ?? 0,
      scale: initialState.scale ?? { x: 1, y: 1 },
      opacity: initialState.opacity ?? 1
    };
    
    for (const transform of sortedTransforms) {
      const animationEndTime = transform.startTime + transform.duration;
      
      if (time >= animationEndTime) {
        // Animation has completed, use its end value
        const endValue = this.getEndValue(transform);
        if (endValue !== null) {
          this.accumulateTransformValue(accumulated, transform, endValue);
        }
      } else if (time >= transform.startTime) {
        // Animation is active, use current interpolated value
        const currentValue = this.evaluateTransform(transform, time);
        if (currentValue !== null) {
          this.accumulateTransformValue(accumulated, transform, currentValue);
        }
      }
      // If animation hasn't started yet, skip it
    }
    
    // Convert accumulated values to results map
    for (const [key, value] of Object.entries(accumulated)) {
      if (value !== undefined) {
        results.set(key, value);
      }
    }
    
    return results;
  }

  // Helper method to accumulate transform values
  private accumulateTransformValue(
    accumulated: Record<string, AnimationValue>,
    transform: SceneTransform,
    value: AnimationValue
  ): void {
    const definition = transformFactory.getTransformDefinition(transform.type);
    if (!definition?.metadata?.targetProperty) return;
    
    const targetProperty = definition.metadata.targetProperty;
    
    switch (targetProperty) {
      case 'position':
        if (typeof value === 'object' && value !== null && 'x' in value && 'y' in value) {
          accumulated.position = value;
        }
        break;
      case 'rotation':
        if (typeof value === 'number') {
          accumulated.rotation = value;
        }
        break;
      case 'scale':
        if (typeof value === 'number') {
          accumulated.scale = { x: value, y: value };
        } else if (typeof value === 'object' && value !== null && 'x' in value && 'y' in value) {
          accumulated.scale = value;
        }
        break;
      case 'opacity':
        if (typeof value === 'number') {
          accumulated.opacity = value;
        }
        break;
    }
  }

  // Get all transform types that are active at a specific time
  getActiveTransforms(transforms: SceneTransform[], time: number): SceneTransform[] {
    return transforms.filter(transform => {
      return time >= transform.startTime && time < transform.startTime + transform.duration;
    });
  }

  // Check if any transforms are active at a specific time
  hasActiveTransforms(transforms: SceneTransform[], time: number): boolean {
    return this.getActiveTransforms(transforms, time).length > 0;
  }
}

// Export singleton instance
export const transformEvaluator = new TransformEvaluator();

// Export convenience functions
export const evaluateTransform = transformEvaluator.evaluateTransform.bind(transformEvaluator);
export const evaluateObjectTransforms = transformEvaluator.evaluateObjectTransforms.bind(transformEvaluator);
export const getAccumulatedObjectState = transformEvaluator.getAccumulatedObjectState.bind(transformEvaluator);
export const getActiveTransforms = transformEvaluator.getActiveTransforms.bind(transformEvaluator);
export const hasActiveTransforms = transformEvaluator.hasActiveTransforms.bind(transformEvaluator);