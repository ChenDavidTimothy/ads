// src/animation/geometry/rectangle.ts
import type { Point2D, NodeCanvasContext } from '../types';

export interface RectangleStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

export function drawRectangle(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  position: Point2D,
  width: number,
  height: number,
  style: RectangleStyle
): void {
  ctx.save();
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.fillRect(position.x, position.y, width, height);
  ctx.strokeRect(position.x, position.y, width, height);
  ctx.restore();
}

export function drawCenteredRectangle(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  center: Point2D,
  width: number,
  height: number,
  rotation = 0,
  style: RectangleStyle
): void {
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  ctx.restore();
}

export function drawRoundedRectangle(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  position: Point2D,
  width: number,
  height: number,
  cornerRadius: number,
  style: RectangleStyle
): void {
  ctx.save();
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  
  ctx.beginPath();
  ctx.moveTo(position.x + cornerRadius, position.y);
  ctx.lineTo(position.x + width - cornerRadius, position.y);
  ctx.quadraticCurveTo(position.x + width, position.y, position.x + width, position.y + cornerRadius);
  ctx.lineTo(position.x + width, position.y + height - cornerRadius);
  ctx.quadraticCurveTo(position.x + width, position.y + height, position.x + width - cornerRadius, position.y + height);
  ctx.lineTo(position.x + cornerRadius, position.y + height);
  ctx.quadraticCurveTo(position.x, position.y + height, position.x, position.y + height - cornerRadius);
  ctx.lineTo(position.x, position.y + cornerRadius);
  ctx.quadraticCurveTo(position.x, position.y, position.x + cornerRadius, position.y);
  ctx.closePath();
  
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawSquare(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  center: Point2D,
  size: number,
  rotation = 0,
  style: RectangleStyle
): void {
  drawCenteredRectangle(ctx, center, size, size, rotation, style);
}