// src/animation/geometry/triangle.ts
import type { Point2D, NodeCanvasContext } from '../types';

export interface TriangleStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

export function drawTriangle(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  center: Point2D,
  size: number,
  rotation = 0,
  style: TriangleStyle
): void {
  ctx.save();
  ctx.translate(Math.round(center.x), Math.round(center.y));
  ctx.rotate(rotation);
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(-size * 0.866, size * 0.5);
  ctx.lineTo(size * 0.866, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawEquilateralTriangle(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  center: Point2D,
  sideLength: number,
  rotation = 0,
  style: TriangleStyle
): void {
  const height = sideLength * Math.sqrt(3) / 2;
  const size = height * 2 / 3; // Distance from center to vertex
  drawTriangle(ctx, center, size, rotation, style);
}

export function drawTriangleFromPoints(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  style: TriangleStyle
): void {
  ctx.save();
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function getTriangleVertices(
  center: Point2D,
  size: number,
  rotation = 0
): [Point2D, Point2D, Point2D] {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  
  // Equilateral triangle vertices (before rotation)
  const v1 = { x: 0, y: -size };
  const v2 = { x: -size * 0.866, y: size * 0.5 };
  const v3 = { x: size * 0.866, y: size * 0.5 };
  
  // Apply rotation and translation
  return [
    {
      x: center.x + (v1.x * cos - v1.y * sin),
      y: center.y + (v1.x * sin + v1.y * cos)
    },
    {
      x: center.x + (v2.x * cos - v2.y * sin),
      y: center.y + (v2.x * sin + v2.y * cos)
    },
    {
      x: center.x + (v3.x * cos - v3.y * sin),
      y: center.y + (v3.x * sin + v3.y * cos)
    }
  ];
}