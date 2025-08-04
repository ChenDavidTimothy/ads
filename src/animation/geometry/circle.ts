// src/animation/geometry/circle.ts
import type { Point2D, NodeCanvasContext } from '../types';

export interface CircleStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

export function drawCircle(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  style: CircleStyle
): void {
  ctx.save();
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawEllipse(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  center: Point2D,
  radiusX: number,
  radiusY: number,
  rotation = 0,
  style: CircleStyle
): void {
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawArc(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  style: CircleStyle
): void {
  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, startAngle, endAngle);
  ctx.stroke();
  ctx.restore();
}

export function drawRing(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  center: Point2D,
  innerRadius: number,
  outerRadius: number,
  style: CircleStyle
): void {
  ctx.save();
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.beginPath();
  ctx.arc(center.x, center.y, outerRadius, 0, Math.PI * 2);
  ctx.arc(center.x, center.y, innerRadius, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}