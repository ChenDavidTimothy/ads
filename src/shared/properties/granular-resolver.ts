// src/shared/properties/granular-resolver.ts

import type { GeometryProperties, SceneObject, TriangleProperties, CircleProperties, RectangleProperties } from '@/shared/types/scene';
import type { PropertySourceMap } from './precedence';
// Legacy import removed
import { 
  type GranularOverrides, 
  convertLegacyToGranular, 
  convertGranularToLegacy 
} from './granular-assignments';

export interface GranularCanvasOverrides {
  'position.x'?: number;
  'position.y'?: number;
  'rotation'?: number;
  'scale.x'?: number;
  'scale.y'?: number;
  'opacity'?: number;
  'fillColor'?: string;
  'strokeColor'?: string;
  'strokeWidth'?: number;
}

export interface GranularResolveResult {
  initialPosition: { x: number; y: number };
  initialRotation: number;
  initialScale: { x: number; y: number };
  initialOpacity: number;
  properties: GeometryProperties;
  sources: PropertySourceMap;
}

// Helper to get a value from granular overrides with fallback
function getGranularValue<T>(
  overrides: GranularOverrides | undefined,
  fieldPath: string,
  fallback: T
): T {
  return (overrides?.[fieldPath] as T) ?? fallback;
}

// Helper to set source based on whether field exists in granular overrides
function setGranularSource(
  sources: PropertySourceMap,
  fieldPath: string,
  overrides: GranularOverrides | undefined,
  canvasOverrides: GranularCanvasOverrides | undefined,
  sourceKey: keyof PropertySourceMap
): void {
  if (overrides?.[fieldPath] !== undefined) {
    (sources as any)[sourceKey] = 'assignment';
  } else if (canvasOverrides?.[fieldPath] !== undefined) {
    (sources as any)[sourceKey] = 'canvas';
  } else {
    (sources as any)[sourceKey] = 'base';
  }
}

export function resolveGranularObject(
  original: SceneObject,
  canvasOverrides?: GranularCanvasOverrides,
  assignments?: { initial?: GranularOverrides }
): GranularResolveResult {
  const sources: PropertySourceMap = {};
  const granularAssignments = assignments?.initial;

  // Position - resolve field by field
  const basePos = original.initialPosition;
  const posX = getGranularValue(granularAssignments, 'position.x', 
    getGranularValue(canvasOverrides, 'position.x', basePos.x));
  const posY = getGranularValue(granularAssignments, 'position.y', 
    getGranularValue(canvasOverrides, 'position.y', basePos.y));
  const initialPosition = { x: posX, y: posY };
  
  // Set source based on which level provided the final value
  if (granularAssignments?.['position.x'] !== undefined || granularAssignments?.['position.y'] !== undefined) {
    sources.position = 'assignment';
  } else if (canvasOverrides?.['position.x'] !== undefined || canvasOverrides?.['position.y'] !== undefined) {
    sources.position = 'canvas';
  } else {
    sources.position = 'base';
  }

  // Rotation
  const initialRotation = getGranularValue(granularAssignments, 'rotation',
    getGranularValue(canvasOverrides, 'rotation', original.initialRotation ?? 0));
  setGranularSource(sources, 'rotation', granularAssignments, canvasOverrides, 'rotation');

  // Scale - resolve field by field
  const baseScale = original.initialScale ?? { x: 1, y: 1 };
  const scaleX = getGranularValue(granularAssignments, 'scale.x',
    getGranularValue(canvasOverrides, 'scale.x', baseScale.x));
  const scaleY = getGranularValue(granularAssignments, 'scale.y',
    getGranularValue(canvasOverrides, 'scale.y', baseScale.y));
  const initialScale = { x: scaleX, y: scaleY };
  
  // Set source based on which level provided the final value
  if (granularAssignments?.['scale.x'] !== undefined || granularAssignments?.['scale.y'] !== undefined) {
    sources.scale = 'assignment';
  } else if (canvasOverrides?.['scale.x'] !== undefined || canvasOverrides?.['scale.y'] !== undefined) {
    sources.scale = 'canvas';
  } else {
    sources.scale = 'base';
  }

  // Opacity
  const initialOpacity = getGranularValue(granularAssignments, 'opacity',
    getGranularValue(canvasOverrides, 'opacity', original.initialOpacity ?? 1));
  setGranularSource(sources, 'opacity', granularAssignments, canvasOverrides, 'opacity');

  // Geometry properties with color/style overrides
  let properties: GeometryProperties;
  switch (original.type) {
    case 'triangle': {
      const base = original.properties as TriangleProperties;
      const copy: TriangleProperties = { ...base };
      
      const fillColor = getGranularValue(granularAssignments, 'fillColor',
        getGranularValue(canvasOverrides, 'fillColor', undefined));
      if (fillColor) {
        copy.color = fillColor;
        sources.colors = { ...(sources.colors ?? {}), fill: granularAssignments?.fillColor !== undefined ? 'assignment' : 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      
      const strokeColor = getGranularValue(granularAssignments, 'strokeColor',
        getGranularValue(canvasOverrides, 'strokeColor', undefined));
      if (strokeColor) {
        copy.strokeColor = strokeColor;
        sources.colors = { ...(sources.colors ?? {}), stroke: granularAssignments?.strokeColor !== undefined ? 'assignment' : 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      
      const strokeWidth = getGranularValue(granularAssignments, 'strokeWidth',
        getGranularValue(canvasOverrides, 'strokeWidth', undefined));
      if (strokeWidth !== undefined) {
        copy.strokeWidth = strokeWidth;
      }
      
      properties = copy;
      break;
    }
    case 'circle': {
      const base = original.properties as CircleProperties;
      const copy: CircleProperties = { ...base };
      
      const fillColor = getGranularValue(granularAssignments, 'fillColor',
        getGranularValue(canvasOverrides, 'fillColor', undefined));
      if (fillColor) {
        copy.color = fillColor;
        sources.colors = { ...(sources.colors ?? {}), fill: granularAssignments?.fillColor !== undefined ? 'assignment' : 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      
      const strokeColor = getGranularValue(granularAssignments, 'strokeColor',
        getGranularValue(canvasOverrides, 'strokeColor', undefined));
      if (strokeColor) {
        copy.strokeColor = strokeColor;
        sources.colors = { ...(sources.colors ?? {}), stroke: granularAssignments?.strokeColor !== undefined ? 'assignment' : 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      
      const strokeWidth = getGranularValue(granularAssignments, 'strokeWidth',
        getGranularValue(canvasOverrides, 'strokeWidth', undefined));
      if (strokeWidth !== undefined) {
        copy.strokeWidth = strokeWidth;
      }
      
      properties = copy;
      break;
    }
    case 'rectangle':
    default: {
      const base = original.properties as RectangleProperties;
      const copy: RectangleProperties = { ...base };
      
      const fillColor = getGranularValue(granularAssignments, 'fillColor',
        getGranularValue(canvasOverrides, 'fillColor', undefined));
      if (fillColor) {
        copy.color = fillColor;
        sources.colors = { ...(sources.colors ?? {}), fill: granularAssignments?.fillColor !== undefined ? 'assignment' : 'canvas' };
      } else {
        sources.colors = { ...(sources.colors ?? {}), fill: 'base' };
      }
      
      const strokeColor = getGranularValue(granularAssignments, 'strokeColor',
        getGranularValue(canvasOverrides, 'strokeColor', undefined));
      if (strokeColor) {
        copy.strokeColor = strokeColor;
        sources.colors = { ...(sources.colors ?? {}), stroke: granularAssignments?.strokeColor !== undefined ? 'assignment' : 'canvas' };
      } else if (copy.strokeColor !== undefined) {
        sources.colors = { ...(sources.colors ?? {}), stroke: 'base' };
      }
      
      const strokeWidth = getGranularValue(granularAssignments, 'strokeWidth',
        getGranularValue(canvasOverrides, 'strokeWidth', undefined));
      if (strokeWidth !== undefined) {
        copy.strokeWidth = strokeWidth;
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

// Legacy compatibility wrapper removed - use resolveGranularObject directly