// src/animation/primitives/translate.ts
import type { Point2D, Transform, EasingFunction } from '../types';
import { Animation } from '../core/animation';
import { lerpPoint } from '../core/interpolation';

export function translate(
  progress: number,
  startPoint: Point2D,
  endPoint: Point2D
): Point2D {
  return lerpPoint(startPoint, endPoint, progress);
}

export function translateX(
  progress: number,
  startX: number,
  endX: number
): Point2D {
  return {
    x: startX + (endX - startX) * progress,
    y: 0
  };
}

export function translateY(
  progress: number,
  startY: number,
  endY: number
): Point2D {
  return {
    x: 0,
    y: startY + (endY - startY) * progress
  };
}

export function circular(
  progress: number,
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number
): Point2D {
  const angle = startAngle + (endAngle - startAngle) * progress;
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle)
  };
}

export class TranslateAnimation extends Animation {
  private startPoint: Point2D;
  private endPoint: Point2D;

  constructor(
    startPoint: Point2D,
    endPoint: Point2D,
    duration: number,
    easingFunction?: EasingFunction
  ) {
    super(duration, easingFunction);
    this.startPoint = startPoint;
    this.endPoint = endPoint;
  }

  animate(progress: number): Transform {
    const translation = translate(progress, this.startPoint, this.endPoint);
    
    return {
      translate: translation,
      rotate: 0,
      scale: { x: 1, y: 1 }
    };
  }
}

export class CircularAnimation extends Animation {
  private center: Point2D;
  private radius: number;
  private startAngle: number;
  private endAngle: number;

  constructor(
    center: Point2D,
    radius: number,
    startAngle: number,
    endAngle: number,
    duration: number,
    easingFunction?: EasingFunction
  ) {
    super(duration, easingFunction);
    this.center = center;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
  }

  animate(progress: number): Transform {
    const translation = circular(
      progress,
      this.center,
      this.radius,
      this.startAngle,
      this.endAngle
    );
    
    return {
      translate: translation,
      rotate: 0,
      scale: { x: 1, y: 1 }
    };
  }
}