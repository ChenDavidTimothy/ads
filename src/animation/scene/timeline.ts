// src/animation/scene/timeline.ts
import type {
  AnimationScene,
  ObjectState,
  SceneObject,
} from "@/shared/types/scene";

import type { Point2D } from "@/shared/types/core";
import type { SceneAnimationTrack } from "@/shared/types";

// Import the new registry system
import {
  transformFactory,
  TransformEvaluator,
  getTransformDefinition,
} from "@/shared/registry/transforms";

// Create an instance of the transform evaluator
const transformEvaluator = new TransformEvaluator();

// Removed legacy interpolation helpers; modern evaluator handles interpolation
type AnimationValue = Point2D | number | string | boolean | null;

// (Legacy easing and color helpers removed; modern evaluator handles interpolation)

// Evaluate a single animation track at a specific time
import type { SceneTransform } from "@/shared/types/transforms";
import { linear, easeInOutCubic, easeInCubic, easeOutCubic } from "@/animation/core/interpolation";

function sceneTrackToSceneTransform(
  track: SceneAnimationTrack,
): SceneTransform {
  return {
    objectId: track.objectId,
    type: track.type,
    startTime: track.startTime,
    duration: track.duration,
    easing: track.easing,
    properties: track.properties,
  };
}

function evaluateAnimation(
  animation: SceneAnimationTrack,
  time: number,
): AnimationValue {
  return transformEvaluator.evaluateTransform(
    sceneTrackToSceneTransform(animation),
    time,
  );
}

function getAnimationEndValue(animation: SceneAnimationTrack): AnimationValue {
  return transformEvaluator.getEndValue(sceneTrackToSceneTransform(animation));
}

function evaluateVisibility(object: SceneObject, time: number): number {
  const appearanceTime =
    (object as unknown as { appearanceTime?: number }).appearanceTime ?? 0;

  if (time < appearanceTime) {
    return 0;
  }

  return object.initialOpacity ?? 1;
}

// Defensive clones
function clonePoint(p: Point2D): Point2D {
  return { x: p.x, y: p.y };
}

// Get the state of an object at a specific time (pure, given animations for that object)
export function getObjectStateAtTime(
  object: SceneObject,
  animations: SceneAnimationTrack[],
  time: number,
): ObjectState {
  const state: ObjectState = {
    position: clonePoint(object.initialPosition),
    rotation: object.initialRotation ?? 0,
    scale: object.initialScale
      ? clonePoint(object.initialScale)
      : { x: 1, y: 1 },
    opacity: evaluateVisibility(object, time),
    colors: {
      // ✅ CHANGE - Read from Canvas properties instead of hardcode
      fill: object.initialFillColor ?? "#4444ff",
      stroke: object.initialStrokeColor ?? "#ffffff",
    },
    strokeWidth: object.initialStrokeWidth ?? 2, // ✅ ADD
  };

  // animations is expected to contain only tracks for this object and be pre-sorted by startTime
  const objectAnimations = animations;

  // Precompute baseline rotations at slide start times to keep Slide relative
  const slideBaselineRotation: Map<string, number> = new Map();
  for (const anim of objectAnimations) {
    if (anim.type !== "slide") continue;
    const s = anim.startTime;
    // Compute rotation at time s based on initial rotation + rotate tracks up to s
    let rot = object.initialRotation ?? 0;
    for (const a of objectAnimations) {
      const def = getTransformDefinition(a.type);
      if (def?.metadata?.targetProperty !== "rotation") continue;
      const end = a.startTime + a.duration;
      if (s >= end) {
        const endV = getAnimationEndValue(a);
        if (typeof endV === "number") rot = endV;
      } else if (s >= a.startTime) {
        const v = evaluateAnimation(a, s);
        if (typeof v === "number") rot = v;
      }
    }
    slideBaselineRotation.set(anim.id, rot);
  }

  // Accumulate additive deltas for Slide transforms
  let slideDelta: Point2D = { x: 0, y: 0 };
  for (const anim of objectAnimations) {
    if (anim.type !== "slide") continue;
    const baselineTurns = slideBaselineRotation.get(anim.id) ?? 0;
    const end = anim.startTime + anim.duration;
    if (time < anim.startTime) continue;
    // Evaluate current delta (clamped inside helper)
    const d = evaluateSlideDelta(anim as any, time, baselineTurns);
    slideDelta = { x: slideDelta.x + d.x, y: slideDelta.y + d.y };
  }

  // Track the accumulated state from completed animations
  const accumulatedState: ObjectState = {
    position: clonePoint(object.initialPosition),
    rotation: object.initialRotation ?? 0,
    scale: object.initialScale
      ? clonePoint(object.initialScale)
      : { x: 1, y: 1 },
    opacity: object.initialOpacity ?? 1,
    colors: {
      // ✅ CHANGE - Read from Canvas properties
      fill: object.initialFillColor ?? "#4444ff",
      stroke: object.initialStrokeColor ?? "#ffffff",
    },
    strokeWidth: object.initialStrokeWidth ?? 2, // ✅ ADD
  };

  for (const animation of objectAnimations) {
    // Special handling for additive Slide transform
    if (animation.type === "slide") {
      // Skip default absolute processing; Slide is additive-only
      continue;
    }
    const animationEndTime = animation.startTime + animation.duration;

    // If this animation has completed, update the accumulated state
    if (time >= animationEndTime) {
      const endValue = getAnimationEndValue(animation);
      if (endValue !== null) {
        updateAccumulatedState(accumulatedState, animation, endValue);
      }
      // Optimization: if the animation ends far before current time, continue
      // We still must process all to accumulate correct end state
    }

    // If animation starts after current time and tracks are sorted, we can break
    if (time < animation.startTime) {
      break;
    }

    // Apply the current animation value (if active) or use accumulated state
    const value = evaluateAnimation(animation, time);
    if (value !== null) {
      updateStateFromAnimation(state, animation, value);
    } else if (time >= animationEndTime) {
      updateStateFromAnimation(state, animation, accumulatedState);
    }
  }

  // Apply additive Slide delta once, after absolute composition is resolved
  state.position = {
    x: state.position.x + slideDelta.x,
    y: state.position.y + slideDelta.y,
  };

  return state;
}

// Helper function to update accumulated state with end values
function updateAccumulatedState(
  accumulatedState: ObjectState,
  animation: SceneAnimationTrack,
  endValue: AnimationValue,
): void {
  const definition = getTransformDefinition(animation.type);
  if (!definition?.metadata?.targetProperty) return;

  switch (definition.metadata.targetProperty) {
    case "position":
      accumulatedState.position = clonePoint(endValue as Point2D);
      break;
    case "rotation":
      accumulatedState.rotation = endValue as number;
      break;
    case "scale": {
      const v = endValue as Point2D;
      accumulatedState.scale = clonePoint(v);
      break;
    }
    case "opacity":
      accumulatedState.opacity = endValue as number;
      break;
    case "color":
      if (animation.type === "color") {
        const colorProperty = animation.properties.property;
        if (colorProperty === "fill") {
          accumulatedState.colors.fill = endValue as string;
        } else if (colorProperty === "stroke") {
          accumulatedState.colors.stroke = endValue as string;
        }
      }
      break;
    // ✅ ADD - New case for strokeWidth animations
    case "strokeWidth":
      accumulatedState.strokeWidth = endValue as number;
      break;
  }
}

// Helper function to update state from animation value or accumulated state
function updateStateFromAnimation(
  state: ObjectState,
  animation: SceneAnimationTrack,
  value: AnimationValue | ObjectState,
  targetProperty?: string,
): void {
  const definition = getTransformDefinition(animation.type);
  const property = targetProperty ?? definition?.metadata?.targetProperty;
  if (!property) return;
  // Do not update absolute position for additive Slide tracks
  if (animation.type === "slide") return;

  function isObjectState(v: unknown): v is ObjectState {
    return (
      typeof v === "object" &&
      v !== null &&
      "position" in v &&
      "rotation" in v &&
      "scale" in v &&
      "opacity" in v
    );
  }

  if (isObjectState(value)) {
    // Value is an ObjectState, extract the specific property
    switch (property) {
      case "position":
        state.position = clonePoint(value.position);
        break;
      case "rotation":
        state.rotation = value.rotation;
        break;
      case "scale":
        state.scale = clonePoint(value.scale);
        break;
      case "opacity":
        state.opacity = value.opacity;
        break;
      case "color":
        if (animation.type === "color") {
          const colorProperty = animation.properties.property;
          if (colorProperty === "fill") {
            state.colors.fill = value.colors.fill;
          } else if (colorProperty === "stroke") {
            state.colors.stroke = value.colors.stroke;
          }
        }
        break;
      // ✅ ADD - New case for strokeWidth animations
      case "strokeWidth":
        state.strokeWidth = value.strokeWidth;
        break;
    }
  } else {
    // Value is a direct animation value
    switch (property) {
      case "position":
        state.position = clonePoint(value as Point2D);
        break;
      case "rotation":
        state.rotation = value as number;
        break;
      case "scale": {
        const v = value as Point2D;
        state.scale = clonePoint(v);
        break;
      }
      case "opacity":
        state.opacity = value as number;
        break;
      case "color":
        if (animation.type === "color") {
          const colorProperty = animation.properties.property;
          if (colorProperty === "fill") {
            state.colors.fill = value as string;
          } else if (colorProperty === "stroke") {
            state.colors.stroke = value as string;
          }
        }
        break;
      // ✅ ADD - New case for strokeWidth animations
      case "strokeWidth":
        state.strokeWidth = value as number;
        break;
    }
  }
}

// Get states of all objects at a specific time (one-shot)
export function getSceneStateAtTime(
  scene: AnimationScene,
  time: number,
): Map<string, ObjectState> {
  const sceneState = new Map<string, ObjectState>();

  // Build per-object animation index once
  const animationsByObject = new Map<string, SceneAnimationTrack[]>();
  for (const anim of scene.animations) {
    const list = animationsByObject.get(anim.objectId) ?? [];
    list.push(anim);
    animationsByObject.set(anim.objectId, list);
  }
  // Sort per-object animations by start time once
  for (const [key, list] of animationsByObject) {
    list.sort((a, b) => a.startTime - b.startTime);
    animationsByObject.set(key, list);
  }

  for (const object of scene.objects) {
    const objectAnimations = animationsByObject.get(object.id) ?? [];
    const objectState = getObjectStateAtTime(object, objectAnimations, time);
    sceneState.set(object.id, objectState);
  }

  return sceneState;
}

// Timeline class for cached evaluation across frames
export class Timeline {
  private readonly scene: AnimationScene;
  private readonly animationsByObject: Map<string, SceneAnimationTrack[]>;

  constructor(scene: AnimationScene) {
    this.scene = scene;
    this.animationsByObject = new Map();

    // Pre-index and sort once
    for (const anim of scene.animations) {
      const list = this.animationsByObject.get(anim.objectId) ?? [];
      list.push(anim);
      this.animationsByObject.set(anim.objectId, list);
    }
    for (const [key, list] of this.animationsByObject) {
      list.sort((a, b) => a.startTime - b.startTime);
      this.animationsByObject.set(key, list);
    }

  }

  getObjectState(objectId: string, time: number): ObjectState | undefined {
    const object = this.scene.objects.find((o) => o.id === objectId);
    if (!object) return undefined;
    const tracks = this.animationsByObject.get(objectId) ?? [];
    return getObjectStateAtTime(object, tracks, time);
  }

  getSceneState(time: number): Map<string, ObjectState> {
    const state = new Map<string, ObjectState>();
    for (const object of this.scene.objects) {
      const objState = this.getObjectState(object.id, time);
      if (objState) state.set(object.id, objState);
    }
    return state;
  }
}

// Helper to create common animation patterns - generic factory + thin wrappers
function createAnimationTrack<TProps extends Record<string, unknown>>(
  type: "move" | "rotate" | "scale" | "fade" | "color" | "slide",
  objectId: string,
  props: TProps,
  startTime: number,
  duration: number,
  easing: "linear" | "easeInOut" | "easeIn" | "easeOut",
): SceneAnimationTrack {
  const transform = transformFactory.createTransform(type, props);
  transform.easing = easing;
  const sceneTransform = transformFactory.createSceneTransform(
    transform,
    objectId,
    startTime,
  );

  const track = {
    id: `${objectId}::${type}::${startTime}`,
    objectId: sceneTransform.objectId,
    type,
    startTime: sceneTransform.startTime,
    duration: sceneTransform.duration,
    easing: sceneTransform.easing,
    properties: props as unknown,
  } as unknown as SceneAnimationTrack;
  return track;
}

export function createMoveAnimation(
  objectId: string,
  from: Point2D,
  to: Point2D,
  startTime: number,
  duration: number,
  easing: "linear" | "easeInOut" | "easeIn" | "easeOut" = "easeInOut",
): SceneAnimationTrack {
  return createAnimationTrack(
    "move",
    objectId,
    { from, to },
    startTime,
    duration,
    easing,
  );
}

export function createRotateAnimation(
  objectId: string,
  from: number,
  to: number,
  startTime: number,
  duration: number,
  easing: "linear" | "easeInOut" | "easeIn" | "easeOut" = "linear",
): SceneAnimationTrack {
  return createAnimationTrack(
    "rotate",
    objectId,
    { from, to },
    startTime,
    duration,
    easing,
  );
}

export function createScaleAnimation(
  objectId: string,
  from: Point2D,
  to: Point2D,
  startTime: number,
  duration: number,
  easing: "linear" | "easeInOut" | "easeIn" | "easeOut" = "easeInOut",
): SceneAnimationTrack {
  return createAnimationTrack(
    "scale",
    objectId,
    { from, to },
    startTime,
    duration,
    easing,
  );
}

// Slide helper - additive motion relative to current orientation at start
export function createSlideAnimation(
  objectId: string,
  orientationDeg: number,
  velocity: number,
  startTime: number,
  duration: number,
  easing: "linear" | "easeInOut" | "easeIn" | "easeOut" = "linear",
): SceneAnimationTrack {
  return createAnimationTrack(
    "slide",
    objectId,
    { orientationDeg, velocity },
    startTime,
    duration,
    easing,
  );
}

// Local easing helper (mirror evaluator mapping)
function getEasingFn(name: string) {
  switch (name) {
    case "easeInOut":
      return easeInOutCubic;
    case "easeIn":
      return easeInCubic;
    case "easeOut":
      return easeOutCubic;
    case "linear":
    default:
      return linear;
  }
}

// Compute Slide delta at a specific time given baseline rotation at start
function evaluateSlideDelta(
  slide: Extract<SceneAnimationTrack, { type: "slide" }>,
  time: number,
  baselineRotationTurns: number, // rotations, 1 = 360°
): Point2D {
  const start = slide.startTime;
  const end = slide.startTime + slide.duration;
  if (time <= start) return { x: 0, y: 0 };
  const t = Math.min(1, Math.max(0, (time - start) / slide.duration));
  const easingFn = getEasingFn(slide.easing);
  const eased = easingFn(t);
  const totalDisplacement = slide.properties.velocity * slide.duration; // px
  const angleRad =
    (baselineRotationTurns * Math.PI * 2) +
    ((slide.properties.orientationDeg ?? 0) * (Math.PI / 180));
  const d = totalDisplacement * eased;
  return { x: d * Math.cos(angleRad), y: d * Math.sin(angleRad) };
}
