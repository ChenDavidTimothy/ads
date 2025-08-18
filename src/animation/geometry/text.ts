import type { Point2D } from '@/shared/types/core';

export interface TextStyle {
  fillColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  fontFamily?: string;
  fontSize: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  content: string,
  style: TextStyle
): void {
  ctx.save();
  
  // Configure font
  const fontString = `${style.fontWeight ?? 'normal'} ${style.fontSize}px ${style.fontFamily ?? 'Arial'}`;
  ctx.font = fontString;
  ctx.fillStyle = style.fillColor;
  ctx.textAlign = mapTextAlign(style.textAlign ?? 'center');
  ctx.textBaseline = 'middle';
  
  // Apply letter spacing if supported
  if (style.letterSpacing && 'letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${style.letterSpacing}px`;
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
    if (style.strokeColor && style.strokeWidth) {
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
