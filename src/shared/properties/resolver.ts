// src/shared/properties/resolver.ts

import type { GeometryProperties, SceneObject, TriangleProperties, CircleProperties, RectangleProperties } from '@/shared/types/scene';
import type { PropertySourceMap } from './precedence';

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
  canvasOverrides?: CanvasOverrides
): ResolveInitialResult {
  const sources: PropertySourceMap = {};

  // Transform-like properties with canvas precedence over base
  const initialPosition = canvasOverrides?.position ?? original.initialPosition;
  sources.position = canvasOverrides?.position ? 'canvas' : 'base';

  const initialRotation = canvasOverrides?.rotation ?? (original.initialRotation ?? 0);
  sources.rotation = canvasOverrides?.rotation ? 'canvas' : 'base';

  const initialScale = canvasOverrides?.scale ?? (original.initialScale ?? { x: 1, y: 1 });
  sources.scale = canvasOverrides?.scale ? 'canvas' : 'base';

  const initialOpacity = canvasOverrides?.opacity ?? (original.initialOpacity ?? 1);
  sources.opacity = canvasOverrides?.opacity ? 'canvas' : 'base';

  // Geometry properties with color/style overrides - clone with correct type
  let properties: GeometryProperties;
  switch (original.type) {
    case 'triangle': {
      const base = original.properties as TriangleProperties;
      const copy: TriangleProperties = { ...base };
      if (typeof canvasOverrides?.fillColor === 'string') {
        copy.color = canvasOverrides.fillColor;
        sources.colors = { ...(sources.colors ?? {}), fill: 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      if (typeof canvasOverrides?.strokeColor === 'string') {
        copy.strokeColor = canvasOverrides.strokeColor;
        sources.colors = { ...(sources.colors ?? {}), stroke: 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      if (typeof canvasOverrides?.strokeWidth === 'number') {
        copy.strokeWidth = canvasOverrides.strokeWidth;
      }
      properties = copy;
      break;
    }
    case 'circle': {
      const base = original.properties as CircleProperties;
      const copy: CircleProperties = { ...base };
      if (typeof canvasOverrides?.fillColor === 'string') {
        copy.color = canvasOverrides.fillColor;
        sources.colors = { ...(sources.colors ?? {}), fill: 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      if (typeof canvasOverrides?.strokeColor === 'string') {
        copy.strokeColor = canvasOverrides.strokeColor;
        sources.colors = { ...(sources.colors ?? {}), stroke: 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      if (typeof canvasOverrides?.strokeWidth === 'number') {
        copy.strokeWidth = canvasOverrides.strokeWidth;
      }
      properties = copy;
      break;
    }
    case 'rectangle':
    default: {
      const base = original.properties as RectangleProperties;
      const copy: RectangleProperties = { ...base };
      if (typeof canvasOverrides?.fillColor === 'string') {
        copy.color = canvasOverrides.fillColor;
        sources.colors = { ...(sources.colors ?? {}), fill: 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      if (typeof canvasOverrides?.strokeColor === 'string') {
        copy.strokeColor = canvasOverrides.strokeColor;
        sources.colors = { ...(sources.colors ?? {}), stroke: 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      if (typeof canvasOverrides?.strokeWidth === 'number') {
        copy.strokeWidth = canvasOverrides.strokeWidth;
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