import type { Point2D } from '@/shared/types/core';

export interface Typography {
  fontFamily?: string;
  fontSize?: number; // Can come from Text node or Typography node
  fontWeight?: string;
  fontStyle?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  content: string,
  style: Typography
): void {
  ctx.save();
  
  // Configure font with all typography properties
  const fontStyle = style.fontStyle ?? 'normal';
  const fontWeight = style.fontWeight ?? 'normal';
  const fontSize = style.fontSize ?? 16;
  const fontFamily = style.fontFamily ?? 'Arial';
  const fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.font = fontString;
  ctx.fillStyle = style.fillColor ?? 'black'; // Fallback to black
  
  // Configure stroke properties for canvas context
  ctx.strokeStyle = style.strokeColor ?? 'transparent';
  ctx.lineWidth = style.strokeWidth ?? 0;

  // Handle multi-line text with simplified layout
  const lines = content.split('\n');
  const lineHeight = fontSize * 1.2; // Fixed line height
  const totalHeight = lines.length * lineHeight;
  const startY = center.y - (totalHeight / 2) + (lineHeight / 2);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue; // Skip undefined lines
    
    const lineY = startY + i * lineHeight;
    
    // Center align all text (simplified)
    const lineWidth = ctx.measureText(line).width;
    const lineX = center.x - lineWidth / 2;
    
    // Draw text with stroke if configured
    if (ctx.strokeStyle && ctx.lineWidth > 0) {
      ctx.strokeText(line, lineX, lineY);
    }
    ctx.fillText(line, lineX, lineY);
  }
  
  ctx.restore();
}
