// src/lib/types/property-schemas.ts
import type { Point2D } from "@/animation/types";

export type PropertyType = 
  | 'number'
  | 'string' 
  | 'color'
  | 'boolean'
  | 'point2d'
  | 'select'
  | 'range';

export interface BasePropertySchema {
  key: string;
  label: string;
  type: PropertyType;
  required?: boolean;
  defaultValue?: any;
}

export interface NumberPropertySchema extends BasePropertySchema {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}

export interface StringPropertySchema extends BasePropertySchema {
  type: 'string';
  defaultValue?: string;
}

export interface ColorPropertySchema extends BasePropertySchema {
  type: 'color';
  defaultValue?: string;
}

export interface BooleanPropertySchema extends BasePropertySchema {
  type: 'boolean';
  defaultValue?: boolean;
}

export interface Point2DPropertySchema extends BasePropertySchema {
  type: 'point2d';
  defaultValue?: Point2D;
}

export interface SelectPropertySchema extends BasePropertySchema {
  type: 'select';
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}

export interface RangePropertySchema extends BasePropertySchema {
  type: 'range';
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
}

export type PropertySchema = 
  | NumberPropertySchema
  | StringPropertySchema
  | ColorPropertySchema
  | BooleanPropertySchema
  | Point2DPropertySchema
  | SelectPropertySchema
  | RangePropertySchema;

export interface NodePropertyConfig {
  properties: PropertySchema[];
}

// Helper to get default values from schema
export function getDefaultPropertiesFromSchema(
  schemas: PropertySchema[]
): Record<string, any> {
  const defaults: Record<string, any> = {};
  
  for (const schema of schemas) {
    if (schema.defaultValue !== undefined) {
      defaults[schema.key] = schema.defaultValue;
    }
  }
  
  return defaults;
}