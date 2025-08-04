// src/animation/core/animation.ts
import type { Transform, EasingFunction } from '../types';
import { linear } from './interpolation';

export abstract class Animation {
  protected duration: number;
  protected easingFunction: EasingFunction;
  protected startTime = 0;

  constructor(duration: number, easingFunction: EasingFunction = linear) {
    this.duration = duration;
    this.easingFunction = easingFunction;
  }

  abstract animate(progress: number): Transform;

  getDuration(): number {
    return this.duration;
  }

  setEasing(easingFunction: EasingFunction): void {
    this.easingFunction = easingFunction;
  }

  getTransformAtTime(time: number): Transform {
    const progress = Math.min(time / this.duration, 1);
    const easedProgress = this.easingFunction(progress);
    return this.animate(easedProgress);
  }
}

export class CompositeAnimation extends Animation {
  private animations: Animation[] = [];

  constructor(animations: Animation[]) {
    const totalDuration = Math.max(...animations.map(anim => anim.getDuration()));
    super(totalDuration);
    this.animations = animations;
  }

  animate(progress: number): Transform {
    const result: Transform = {
      translate: { x: 0, y: 0 },
      rotate: 0,
      scale: { x: 1, y: 1 }
    };

    for (const animation of this.animations) {
      const animProgress = Math.min(progress * this.duration / animation.getDuration(), 1);
      const transform = animation.animate(animProgress);
      
      result.translate.x += transform.translate.x;
      result.translate.y += transform.translate.y;
      result.rotate += transform.rotate;
      result.scale.x *= transform.scale.x;
      result.scale.y *= transform.scale.y;
    }

    return result;
  }
}

export function sequence(...animations: Animation[]): Animation[] {
  return animations;
}

export function parallel(...animations: Animation[]): CompositeAnimation {
  return new CompositeAnimation(animations);
}