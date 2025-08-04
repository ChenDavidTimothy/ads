// src/animation/core/transforms.ts
import type { Point2D, Transform, NodeCanvasContext } from '../types';

export function applyTranslation(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  translation: Point2D
): void {
  ctx.translate(Math.round(translation.x), Math.round(translation.y));
}

export function applyRotation(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  rotation: number
): void {
  ctx.rotate(rotation);
}

export function applyScale(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  scale: Point2D
): void {
  ctx.scale(scale.x, scale.y);
}

export function applyTransform(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  transform: Transform
): void {
  applyTranslation(ctx, transform.translate);
  applyRotation(ctx, transform.rotate);
  applyScale(ctx, transform.scale);
}

export function saveAndTransform(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  transform: Transform,
  drawCallback: () => void
): void {
  ctx.save();
  applyTransform(ctx, transform);
  drawCallback();
  ctx.restore();
}

export function parseTransformString(transform?: string): Transform {
  const result: Transform = {
    translate: { x: 0, y: 0 },
    rotate: 0,
    scale: { x: 1, y: 1 }
  };

  if (!transform) return result;
  
  const translateMatch = /translate\(([^,]+),([^)]+)\)/.exec(transform);
  if (translateMatch?.[1] && translateMatch?.[2]) {
    result.translate.x = parseFloat(translateMatch[1]);
    result.translate.y = parseFloat(translateMatch[2]);
  }
  
  const scaleMatch = /scale\(([^,]+)(?:,([^)]+))?\)/.exec(transform);
  if (scaleMatch?.[1]) {
    result.scale.x = parseFloat(scaleMatch[1]);
    result.scale.y = scaleMatch[2] ? parseFloat(scaleMatch[2]) : result.scale.x;
  }
  
  const rotateMatch = /rotate\(([^)]+)\)/.exec(transform);
  if (rotateMatch?.[1]) {
    result.rotate = parseFloat(rotateMatch[1]) * Math.PI / 180;
  }
  
  return result;
}