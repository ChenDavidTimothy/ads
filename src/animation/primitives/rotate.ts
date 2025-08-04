// src/animation/primitives/rotate.ts
import type { Transform, EasingFunction } from '../types';
import { Animation } from '../core/animation';
import { lerp } from '../core/interpolation';

export function rotate(
  progress: number,
  startAngle: number,
  endAngle: number
): number {
  return lerp(startAngle, endAngle, progress);
}

export function continuousRotation(
  progress: number,
  rotations: number,
  startAngle = 0
): number {
  return startAngle + progress * Math.PI * 2 * rotations;
}

export function oscillateRotation(
  progress: number,
  amplitude: number,
  frequency: number
): number {
  return amplitude * Math.sin(progress * frequency * Math.PI * 2);
}

export class RotateAnimation extends Animation {
  private startAngle: number;
  private endAngle: number;

  constructor(
    startAngle: number,
    endAngle: number,
    duration: number,
    easingFunction?: EasingFunction
  ) {
    super(duration, easingFunction);
    this.startAngle = startAngle;
    this.endAngle = endAngle;
  }

  animate(progress: number): Transform {
    const rotation = rotate(progress, this.startAngle, this.endAngle);
    
    return {
      translate: { x: 0, y: 0 },
      rotate: rotation,
      scale: { x: 1, y: 1 }
    };
  }
}

export class ContinuousRotateAnimation extends Animation {
  private rotations: number;
  private startAngle: number;

  constructor(
    rotations: number,
    duration: number,
    startAngle = 0,
    easingFunction?: EasingFunction
  ) {
    super(duration, easingFunction);
    this.rotations = rotations;
    this.startAngle = startAngle;
  }

  animate(progress: number): Transform {
    const rotation = continuousRotation(progress, this.rotations, this.startAngle);
    
    return {
      translate: { x: 0, y: 0 },
      rotate: rotation,
      scale: { x: 1, y: 1 }
    };
  }
}