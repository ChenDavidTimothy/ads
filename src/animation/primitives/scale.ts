// src/animation/primitives/scale.ts
import type { Point2D, Transform, EasingFunction } from '../types';
import { Animation } from '../core/animation';
import { lerp } from '../core/interpolation';

export function scale(
  progress: number,
  startScale: Point2D,
  endScale: Point2D
): Point2D {
  return {
    x: lerp(startScale.x, endScale.x, progress),
    y: lerp(startScale.y, endScale.y, progress)
  };
}

export function uniformScale(
  progress: number,
  startScale: number,
  endScale: number
): Point2D {
  const scaleValue = lerp(startScale, endScale, progress);
  return { x: scaleValue, y: scaleValue };
}

export function pulse(
  progress: number,
  baseScale: number,
  amplitude: number,
  frequency: number
): Point2D {
  const pulseValue = baseScale + amplitude * Math.sin(progress * frequency * Math.PI * 2);
  return { x: pulseValue, y: pulseValue };
}

export class ScaleAnimation extends Animation {
  private startScale: Point2D;
  private endScale: Point2D;

  constructor(
    startScale: Point2D,
    endScale: Point2D,
    duration: number,
    easingFunction?: EasingFunction
  ) {
    super(duration, easingFunction);
    this.startScale = startScale;
    this.endScale = endScale;
  }

  animate(progress: number): Transform {
    const scaleValue = scale(progress, this.startScale, this.endScale);
    
    return {
      translate: { x: 0, y: 0 },
      rotate: 0,
      scale: scaleValue
    };
  }
}

export class UniformScaleAnimation extends Animation {
  private startScale: number;
  private endScale: number;

  constructor(
    startScale: number,
    endScale: number,
    duration: number,
    easingFunction?: EasingFunction
  ) {
    super(duration, easingFunction);
    this.startScale = startScale;
    this.endScale = endScale;
  }

  animate(progress: number): Transform {
    const scaleValue = uniformScale(progress, this.startScale, this.endScale);
    
    return {
      translate: { x: 0, y: 0 },
      rotate: 0,
      scale: scaleValue
    };
  }
}

export class PulseAnimation extends Animation {
  private baseScale: number;
  private amplitude: number;
  private frequency: number;

  constructor(
    baseScale: number,
    amplitude: number,
    frequency: number,
    duration: number,
    easingFunction?: EasingFunction
  ) {
    super(duration, easingFunction);
    this.baseScale = baseScale;
    this.amplitude = amplitude;
    this.frequency = frequency;
  }

  animate(progress: number): Transform {
    const scaleValue = pulse(progress, this.baseScale, this.amplitude, this.frequency);
    
    return {
      translate: { x: 0, y: 0 },
      rotate: 0,
      scale: scaleValue
    };
  }
}