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

export interface AnimationConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  triangleSize: number;
  margin: number;
  rotations: number;
  backgroundColor: string;
  triangleColor: string;
  strokeColor: string;
  strokeWidth: number;
  videoPreset: string;
  videoCrf: number;
}