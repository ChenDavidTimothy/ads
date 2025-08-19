import type { Point2D } from '@/shared/types/core';

export interface TextStyle {
  // EXISTING PROPERTIES (keep unchanged)
  fontFamily?: string;
  fontSize?: number; // Can come from Text node or TextStyle node
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  
  // NEW PROPERTIES - Add these
  fontStyle?: string;
  textBaseline?: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'bottom';
  direction?: 'ltr' | 'rtl';
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  textOpacity?: number;
}

// Manual letter spacing implementation (Canvas2D compatible)
function drawTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number
): void {
  if (!letterSpacing || letterSpacing === 0) {
    ctx.fillText(text, x, y);
    if (ctx.strokeStyle && ctx.lineWidth > 0) {
      ctx.strokeText(text, x, y);
    }
    return;
  }

  let currentX = x;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    ctx.fillText(char, currentX, y);
    if (ctx.strokeStyle && ctx.lineWidth > 0) {
      ctx.strokeText(char, currentX, y);
    }
    const charWidth = ctx.measureText(char).width;
    currentX += charWidth + letterSpacing;
  }
}

function measureTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number
): number {
  if (!letterSpacing || letterSpacing === 0) {
    return ctx.measureText(text).width;
  }

  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charWidth = ctx.measureText(char).width;
    totalWidth += charWidth;
    if (i < text.length - 1) {
      totalWidth += letterSpacing;
    }
  }
  return totalWidth;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  content: string,
  style: TextStyle
): void {
  ctx.save();
  
  // Configure font with all typography properties
  const fontString = `${style.fontStyle ?? 'normal'} ${style.fontWeight ?? 'normal'} ${style.fontSize ?? 16}px ${style.fontFamily ?? 'Arial'}`;
  ctx.font = fontString;
  ctx.fillStyle = style.fillColor ?? 'black'; // Fallback to black
  ctx.textAlign = mapTextAlign(style.textAlign ?? 'center');
  ctx.textBaseline = mapTextBaseline(style.textBaseline ?? 'middle');
  ctx.direction = style.direction ?? 'ltr';
  
  // Apply text opacity
  if (style.textOpacity !== undefined) {
    ctx.globalAlpha = style.textOpacity;
  }

  // Apply shadow effects
  if (style.shadowColor || style.shadowOffsetX || style.shadowOffsetY || style.shadowBlur) {
    ctx.shadowColor = style.shadowColor ?? 'transparent';
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0;
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0;
    ctx.shadowBlur = style.shadowBlur ?? 0;
  }

  // Handle multi-line text
  const lines = content.split('\n');
  const fontSize = style.fontSize ?? 16; // Default fallback
  const lineHeight = fontSize * (style.lineHeight ?? 1.2);
  const totalHeight = lines.length * lineHeight;
  const startY = center.y - (totalHeight / 2) + (lineHeight / 2);
  const letterSpacing = style.letterSpacing ?? 0; // Default fallback
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineY = startY + i * lineHeight;
    
    // Calculate line width for text alignment
    let lineX = center.x;
    if (style.textAlign === 'left') {
      lineX = center.x;
    } else if (style.textAlign === 'right') {
      const lineWidth = measureTextWithLetterSpacing(ctx, line, letterSpacing);
      lineX = center.x - lineWidth;
    } else if (style.textAlign === 'center') {
      const lineWidth = measureTextWithLetterSpacing(ctx, line, letterSpacing);
      lineX = center.x - lineWidth / 2;
    }
    
    drawTextWithLetterSpacing(ctx, line, lineX, lineY, letterSpacing);
  }
  
  ctx.restore();
}

function mapTextAlign(align: string): CanvasTextAlign {
  switch (align) {
    case 'left': return 'left';
    case 'center': return 'center';
    case 'right': return 'right';
    case 'justify': return 'left'; // Canvas doesn't support justify
    default: return 'center';
  }
}

function mapTextBaseline(baseline: string): CanvasTextBaseline {
  switch (baseline) {
    case 'top': return 'top';
    case 'hanging': return 'hanging';
    case 'middle': return 'middle';
    case 'alphabetic': return 'alphabetic';
    case 'bottom': return 'bottom';
    default: return 'middle';
  }
}
