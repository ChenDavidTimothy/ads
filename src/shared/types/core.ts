// src/shared/types/core.ts
import type { CanvasRenderingContext2D as NodeCanvasCtx } from 'canvas';

export interface Point2D {
  x: number;
  y: number;
}

export interface Transform {
  translate: Point2D;
  rotate: number;
  scale: Point2D;
}

export type NodeCanvasContext = NodeCanvasCtx;
export type EasingFunction = (t: number) => number;