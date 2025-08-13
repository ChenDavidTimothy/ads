// src/shared/properties/resolver.ts

import type { GeometryProperties, SceneObject, TriangleProperties, CircleProperties, RectangleProperties } from '@/shared/types/scene';
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
  properties: GeometryProperties;
  sources: PropertySourceMap;
}

export function resolveInitialObject(
  original: SceneObject,
  canvasOverrides?: CanvasOverrides,
  assignments?: ObjectAssignments
): ResolveInitialResult {
  const sources: PropertySourceMap = {};

  // Transform-like properties with precedence: base < canvas < assignment
  const initialPosition = assignments?.initial?.position
    ?? canvasOverrides?.position
    ?? original.initialPosition;
  sources.position = assignments?.initial?.position ? 'assignment' : canvasOverrides?.position ? 'canvas' : 'base';

  const initialRotation = assignments?.initial?.rotation
    ?? (canvasOverrides?.rotation ?? (original.initialRotation ?? 0));
  sources.rotation = assignments?.initial?.rotation ? 'assignment' : canvasOverrides?.rotation ? 'canvas' : 'base';

  const initialScale = assignments?.initial?.scale
    ?? (canvasOverrides?.scale ?? (original.initialScale ?? { x: 1, y: 1 }));
  sources.scale = assignments?.initial?.scale ? 'assignment' : canvasOverrides?.scale ? 'canvas' : 'base';

  const initialOpacity = assignments?.initial?.opacity
    ?? (canvasOverrides?.opacity ?? (original.initialOpacity ?? 1));
  sources.opacity = assignments?.initial?.opacity ? 'assignment' : canvasOverrides?.opacity ? 'canvas' : 'base';

  // Geometry properties with color/style overrides - clone with correct type
  let properties: GeometryProperties;
  switch (original.type) {
    case 'triangle': {
      const base = original.properties as TriangleProperties;
      const copy: TriangleProperties = { ...base };
      const fill = assignments?.initial?.fillColor ?? canvasOverrides?.fillColor;
      if (typeof fill === 'string') {
        copy.color = fill;
        sources.colors = { ...(sources.colors ?? {}), fill: assignments?.initial?.fillColor ? 'assignment' : 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      const stroke = assignments?.initial?.strokeColor ?? canvasOverrides?.strokeColor;
      if (typeof stroke === 'string') {
        copy.strokeColor = stroke;
        sources.colors = { ...(sources.colors ?? {}), stroke: assignments?.initial?.strokeColor ? 'assignment' : 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      const strokeW = assignments?.initial?.strokeWidth ?? canvasOverrides?.strokeWidth;
      if (typeof strokeW === 'number') {
        copy.strokeWidth = strokeW;
      }
      properties = copy;
      break;
    }
    case 'circle': {
      const base = original.properties as CircleProperties;
      const copy: CircleProperties = { ...base };
      const fill = assignments?.initial?.fillColor ?? canvasOverrides?.fillColor;
      if (typeof fill === 'string') {
        copy.color = fill;
        sources.colors = { ...(sources.colors ?? {}), fill: assignments?.initial?.fillColor ? 'assignment' : 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      const stroke = assignments?.initial?.strokeColor ?? canvasOverrides?.strokeColor;
      if (typeof stroke === 'string') {
        copy.strokeColor = stroke;
        sources.colors = { ...(sources.colors ?? {}), stroke: assignments?.initial?.strokeColor ? 'assignment' : 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      const strokeW = assignments?.initial?.strokeWidth ?? canvasOverrides?.strokeWidth;
      if (typeof strokeW === 'number') {
        copy.strokeWidth = strokeW;
      }
      properties = copy;
      break;
    }
    case 'rectangle':
    default: {
      const base = original.properties as RectangleProperties;
      const copy: RectangleProperties = { ...base };
      const fill = assignments?.initial?.fillColor ?? canvasOverrides?.fillColor;
      if (typeof fill === 'string') {
        copy.color = fill;
        sources.colors = { ...(sources.colors ?? {}), fill: assignments?.initial?.fillColor ? 'assignment' : 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      const stroke = assignments?.initial?.strokeColor ?? canvasOverrides?.strokeColor;
      if (typeof stroke === 'string') {
        copy.strokeColor = stroke;
        sources.colors = { ...(sources.colors ?? {}), stroke: assignments?.initial?.strokeColor ? 'assignment' : 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      const strokeW = assignments?.initial?.strokeWidth ?? canvasOverrides?.strokeWidth;
      if (typeof strokeW === 'number') {
        copy.strokeWidth = strokeW;
      }
      properties = copy;
      break;
    }
  }

  return {
    initialPosition,
    initialRotation,
    initialScale,
    initialOpacity,
    properties,
    sources,
  };
}