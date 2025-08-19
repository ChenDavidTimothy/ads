// src/shared/properties/resolver.ts

import type { GeometryProperties, SceneObject, TriangleProperties, CircleProperties, RectangleProperties, TextProperties } from '@/shared/types/scene';
import type { PropertySourceMap } from './precedence';
import type { ObjectAssignments } from './assignments';

export interface CanvasOverrides {
  position?: { x: number; y: number };
  rotation?: number;
  scale?: { x: number; y: number };
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface ResolveInitialResult {
  initialPosition: { x: number; y: number };
  initialRotation: number;
  initialScale: { x: number; y: number };
  initialOpacity: number;
  initialFillColor: string;
  initialStrokeColor: string;
  initialStrokeWidth: number;
  properties: GeometryProperties;
  sources: PropertySourceMap;
}

export function resolveInitialObject(
  original: SceneObject,
  canvasOverrides?: CanvasOverrides,
  assignments?: ObjectAssignments
): ResolveInitialResult {
  const sources: PropertySourceMap = {};

  // Canvas overrides are now REQUIRED for styling - provide good defaults
  const defaultCanvas: Required<CanvasOverrides> = {
    position: { x: 960, y: 540 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    opacity: 1,
    fillColor: '#4444ff',
    strokeColor: '#ffffff', 
    strokeWidth: 2
  };

  const effectiveCanvas = { ...defaultCanvas, ...canvasOverrides };

  // Transform-like properties with precedence: base < canvas < assignment (merged per field)
  const basePos = original.initialPosition;
  let initialPosition = { ...basePos };
  if (canvasOverrides?.position) initialPosition = { ...initialPosition, ...canvasOverrides.position };
  if (assignments?.initial?.position) initialPosition = { ...initialPosition, ...assignments.initial.position };
  sources.position = assignments?.initial?.position ? 'assignment' : canvasOverrides?.position ? 'canvas' : 'base';

  const initialRotation = assignments?.initial?.rotation
    ?? (canvasOverrides?.rotation ?? (original.initialRotation ?? 0));
  sources.rotation = assignments?.initial?.rotation ? 'assignment' : canvasOverrides?.rotation ? 'canvas' : 'base';

  const baseScale = original.initialScale ?? { x: 1, y: 1 };
  let initialScale = { ...baseScale };
  if (canvasOverrides?.scale) initialScale = { ...initialScale, ...canvasOverrides.scale };
  if (assignments?.initial?.scale) initialScale = { ...initialScale, ...assignments.initial.scale };
  sources.scale = assignments?.initial?.scale ? 'assignment' : canvasOverrides?.scale ? 'canvas' : 'base';

  const initialOpacity = assignments?.initial?.opacity
    ?? (canvasOverrides?.opacity ?? (original.initialOpacity ?? 1));
  sources.opacity = assignments?.initial?.opacity ? 'assignment' : canvasOverrides?.opacity ? 'canvas' : 'base';

  // ✅ ADD - Following exact pattern as opacity
  const initialFillColor = assignments?.initial?.fillColor
    ?? (canvasOverrides?.fillColor ?? '#4444ff');
  sources.colors = sources.colors ?? {};
  sources.colors.fill = assignments?.initial?.fillColor ? 'assignment' : canvasOverrides?.fillColor ? 'canvas' : 'base';

  const initialStrokeColor = assignments?.initial?.strokeColor
    ?? (canvasOverrides?.strokeColor ?? '#ffffff');
  sources.colors.stroke = assignments?.initial?.strokeColor ? 'assignment' : canvasOverrides?.strokeColor ? 'canvas' : 'base';

  const initialStrokeWidth = assignments?.initial?.strokeWidth
    ?? (canvasOverrides?.strokeWidth ?? 2);
  sources.strokeWidth = assignments?.initial?.strokeWidth ? 'assignment' : canvasOverrides?.strokeWidth ? 'canvas' : 'base';

  // Geometry properties with Canvas-provided styling - clone with correct type
  let properties: GeometryProperties;
  switch (original.type) {
    case 'triangle': {
      const base = original.properties as TriangleProperties;
      properties = {
        ...base,
        color: assignments?.initial?.fillColor ?? effectiveCanvas.fillColor,
        strokeColor: assignments?.initial?.strokeColor ?? effectiveCanvas.strokeColor,
        strokeWidth: assignments?.initial?.strokeWidth ?? effectiveCanvas.strokeWidth,
      } as TriangleProperties & { color: string; strokeColor: string; strokeWidth: number };
      break;
    }
    case 'circle': {
      const base = original.properties as CircleProperties;
      properties = {
        ...base,
        color: assignments?.initial?.fillColor ?? effectiveCanvas.fillColor,
        strokeColor: assignments?.initial?.strokeColor ?? effectiveCanvas.strokeColor,
        strokeWidth: assignments?.initial?.strokeWidth ?? effectiveCanvas.strokeWidth,
      } as CircleProperties & { color: string; strokeColor: string; strokeWidth: number };
      break;
    }
    case 'rectangle': {
      const base = original.properties as RectangleProperties;
      properties = {
        ...base,
        color: assignments?.initial?.fillColor ?? effectiveCanvas.fillColor,
        strokeColor: assignments?.initial?.strokeColor ?? effectiveCanvas.strokeColor,
        strokeWidth: assignments?.initial?.strokeWidth ?? effectiveCanvas.strokeWidth,
      } as RectangleProperties & { color: string; strokeColor: string; strokeWidth: number };
      break;
    }
    case 'text': {
      const base = original.properties as TextProperties;
      properties = {
        ...base,
        color: assignments?.initial?.fillColor ?? effectiveCanvas.fillColor,
        strokeColor: assignments?.initial?.strokeColor ?? effectiveCanvas.strokeColor,
        strokeWidth: assignments?.initial?.strokeWidth ?? effectiveCanvas.strokeWidth,
      } as TextProperties & { color: string; strokeColor: string; strokeWidth: number };
      break;
    }
    default: {
      // Type assertion to handle the never case
      const type = original.type as string;
      throw new Error(`Unknown geometry type: ${type}`);
    }
  }

  // Track sources for styling properties
  sources.colors = {
    fill: assignments?.initial?.fillColor ? 'assignment' : 'canvas',
    stroke: assignments?.initial?.strokeColor ? 'assignment' : 'canvas'
  } as const;
  sources.strokeWidth = assignments?.initial?.strokeWidth ? 'assignment' : 'canvas';

  return {
    initialPosition,
    initialRotation,
    initialScale,
    initialOpacity,
    initialFillColor,
    initialStrokeColor,
    initialStrokeWidth,
    properties,
    sources
  };
}