// src/shared/registry/transform-evaluator.ts - Transform evaluator system
import type { SceneTransform, AnimationValue } from "../types/transforms";
import type { Point2D } from "../types/core";
import { transformFactory } from "./transform-factory";
import {
  getInterpolator,
  getInterpolatorForValue,
} from "./interpolator-registry";
import {
  linear,
  easeInOutCubic,
  easeInCubic,
  easeOutCubic,
} from "../../animation/core/interpolation";

// Easing function registry
const EASING_REGISTRY = {
  linear,
  easeInOut: easeInOutCubic,
  easeIn: easeInCubic,
  easeOut: easeOutCubic,
};

// Get easing function by name
function getEasingFunction(easing: string) {
  return EASING_REGISTRY[easing as keyof typeof EASING_REGISTRY] || linear;
}

// Transform evaluator class
export class TransformEvaluator {
  // Evaluate a transform at a specific time
  evaluateTransform(transform: SceneTransform, time: number): AnimationValue {
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
    // Prefer explicit 'to' if present
    let endValue = null;
    if (Object.prototype.hasOwnProperty.call(transform.properties, "to")) {
      endValue = transform.properties.to as AnimationValue;
    } else {
      // Fallback: try property schema from definition
      const definition = transformFactory.getTransformDefinition(transform.type);
      if (!definition) {
        return null;
      }
      const toDef = definition.properties.find((p) => p.key === "to");
      if (toDef) {
        endValue = transform.properties[toDef.key] as AnimationValue;
      }
    }

    // Special safeguard for scale transforms to prevent zero values
    if (transform.type === "scale" && typeof endValue === "number") {
      endValue = Math.max(endValue, 0.001);
    }

    return endValue;
  }

  // Interpolate a transform at a specific progress
  private interpolateTransform(
    transform: SceneTransform,
    progress: number,
  ): AnimationValue {
    const definition = transformFactory.getTransformDefinition(transform.type);
    if (!definition) {
      return null;
    }

    // Generic interpolation: assume standard from/to schema, guided by definition
    const fromKey =
      definition.properties.find((p) => p.key === "from")?.key ?? "from";
    const toKey =
      definition.properties.find((p) => p.key === "to")?.key ?? "to";

    const from = transform.properties[fromKey];
    const to = transform.properties[toKey];

    // If either from or to is missing, nothing to interpolate
    if (from === undefined || to === undefined) {
      return null;
    }

    // Determine type from definition first, then by value
    const typeFromDef =
      definition.properties.find((p) => p.key === toKey)?.type ??
      definition.properties.find((p) => p.key === fromKey)?.type;

    if (typeFromDef) {
      const interpolator = getInterpolator(typeFromDef);
      let interpolatedValue = interpolator.interpolate(
        from as never,
        to as never,
        progress,
      ) as AnimationValue;

      // Special safeguard for scale transforms to prevent zero values
      if (transform.type === "scale" && typeof interpolatedValue === "number") {
        interpolatedValue = Math.max(interpolatedValue, 0.001);
      }

      return interpolatedValue;
    }

    // Fallback: detect interpolator by runtime value type
    const runtimeInterpolator =
      getInterpolatorForValue(to) ?? getInterpolatorForValue(from);
    if (runtimeInterpolator) {
      return runtimeInterpolator.interpolate(
        from as never,
        to as never,
        progress,
      ) as AnimationValue;
    }

    return null;
  }

  // Evaluate multiple transforms for an object
  evaluateObjectTransforms(
    transforms: SceneTransform[],
    time: number,
  ): Map<string, AnimationValue> {
    const results = new Map<string, AnimationValue>();

    for (const transform of transforms) {
      const value = this.evaluateTransform(transform, time);
      if (value !== null) {
        const definition = transformFactory.getTransformDefinition(
          transform.type,
        );
        const key = definition?.metadata?.targetProperty ?? transform.type;
        results.set(key, value);
      }
    }

    return results;
  }

  // Get the final accumulated state for an object at a specific time
  getAccumulatedObjectState(
    transforms: SceneTransform[],
    time: number,
    initialState: {
      position?: Point2D;
      rotation?: number;
      scale?: Point2D;
      opacity?: number;
    },
  ): Map<string, AnimationValue> {
    const results = new Map<string, AnimationValue>();

    // Sort transforms by start time to ensure proper order
    const sortedTransforms = [...transforms].sort(
      (a, b) => a.startTime - b.startTime,
    );

    // Track accumulated values
    const accumulated: Record<string, AnimationValue> = {
      position: initialState.position ?? { x: 0, y: 0 },
      rotation: initialState.rotation ?? 0,
      scale: initialState.scale ?? { x: 1, y: 1 },
      opacity: initialState.opacity ?? 1,
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
    value: AnimationValue,
  ): void {
    const definition = transformFactory.getTransformDefinition(transform.type);
    if (!definition?.metadata?.targetProperty) return;

    const targetProperty = definition.metadata.targetProperty;

    switch (targetProperty) {
      case "position":
        if (
          typeof value === "object" &&
          value !== null &&
          "x" in value &&
          "y" in value
        ) {
          const point = value as { x: number; y: number };
          accumulated.position = {
            x: point.x,
            y: point.y,
          } as unknown as AnimationValue;
        }
        break;
      case "rotation":
        if (typeof value === "number") {
          accumulated.rotation = value;
        }
        break;
      case "scale":
        if (typeof value === "number") {
          accumulated.scale = {
            x: value,
            y: value,
          } as unknown as AnimationValue;
        } else if (
          typeof value === "object" &&
          value !== null &&
          "x" in value &&
          "y" in value
        ) {
          const point = value as { x: number; y: number };
          accumulated.scale = {
            x: point.x,
            y: point.y,
          } as unknown as AnimationValue;
        }
        break;
      case "opacity":
        if (typeof value === "number") {
          accumulated.opacity = value;
        }
        break;
      case "color":
        // color accumulation is handled at application time using animation.properties.property
        break;
    }
  }

  // Get all transform types that are active at a specific time
  getActiveTransforms(
    transforms: SceneTransform[],
    time: number,
  ): SceneTransform[] {
    return transforms.filter((transform) => {
      return (
        time >= transform.startTime &&
        time < transform.startTime + transform.duration
      );
    });
  }

  // Check if any transforms are active at a specific time
  hasActiveTransforms(transforms: SceneTransform[], time: number): boolean {
    return this.getActiveTransforms(transforms, time).length > 0;
  }
}

// Export singleton instance
export const transformEvaluator = new TransformEvaluator();

// Export convenience wrappers to avoid unbound method references
export const evaluateTransform = (transform: SceneTransform, time: number) =>
  transformEvaluator.evaluateTransform(transform, time);
export const evaluateObjectTransforms = (
  transforms: SceneTransform[],
  time: number,
) => transformEvaluator.evaluateObjectTransforms(transforms, time);
export const getAccumulatedObjectState = (
  transforms: SceneTransform[],
  time: number,
  initialState: {
    position?: Point2D;
    rotation?: number;
    scale?: Point2D;
    opacity?: number;
  },
) =>
  transformEvaluator.getAccumulatedObjectState(transforms, time, initialState);
export const getActiveTransforms = (
  transforms: SceneTransform[],
  time: number,
) => transformEvaluator.getActiveTransforms(transforms, time);
export const hasActiveTransforms = (
  transforms: SceneTransform[],
  time: number,
) => transformEvaluator.hasActiveTransforms(transforms, time);
