import type { Point2D } from '@/shared/types/core';

export interface TextStyle {
  // EXISTING PROPERTIES (keep unchanged)
  fontFamily?: string;
  fontSize: number; // From Text node, not TextStyle
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  
  // NEW PROPERTIES - Add these
  fontStyle?: string;
  textBaseline?: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'bottom';
  direction?: 'ltr' | 'rtl';
  fillColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  textOpacity?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  content: string,
  style: TextStyle
): void {
  ctx.save();
  
  // Configure font with all typography properties
  const fontString = `${style.fontStyle ?? 'normal'} ${style.fontWeight ?? 'normal'} ${style.fontSize}px ${style.fontFamily ?? 'Arial'}`;
  ctx.font = fontString;
  ctx.fillStyle = style.fillColor;
  ctx.textAlign = mapTextAlign(style.textAlign ?? 'center');
  ctx.textBaseline = mapTextBaseline(style.textBaseline ?? 'middle');
  ctx.direction = style.direction ?? 'ltr';
  
  // Apply text opacity
  if (style.textOpacity !== undefined) {
    ctx.globalAlpha = style.textOpacity;
  }
  
  // Apply letter spacing if supported
  if (style.letterSpacing && 'letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${style.letterSpacing}px`;
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
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.2);
  const totalHeight = lines.length * lineHeight;
  const startY = center.y - (totalHeight / 2) + (lineHeight / 2);
  
  lines.forEach((line, index) => {
    const y = startY + (index * lineHeight);
    ctx.fillText(line, center.x, y);
    
    // Draw stroke if specified
    if (style.strokeColor && style.strokeWidth && style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeText(line, center.x, y);
    }
  });
  
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
