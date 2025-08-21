// src/shared/types/properties.ts
import type { Point2D } from "./core";
import { z } from "zod";

export type PropertyType =
  | "textarea"
  | "number"
  | "string"
  | "color"
  | "boolean"
  | "point2d"
  | "select"
  | "range";

export interface BasePropertySchema {
  key: string;
  label: string;
  type: PropertyType;
  required?: boolean;
  defaultValue?: string | number | boolean | Point2D;
}

export interface NumberPropertySchema extends BasePropertySchema {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}

export interface StringPropertySchema extends BasePropertySchema {
  type: "string";
  defaultValue?: string;
}

export interface TextareaPropertySchema extends BasePropertySchema {
  type: "textarea";
  rows?: number;
  defaultValue?: string;
}

export interface ColorPropertySchema extends BasePropertySchema {
  type: "color";
  defaultValue?: string;
}

export interface BooleanPropertySchema extends BasePropertySchema {
  type: "boolean";
  defaultValue?: boolean;
}

export interface Point2DPropertySchema extends BasePropertySchema {
  type: "point2d";
  defaultValue?: Point2D;
}

export interface SelectPropertySchema extends BasePropertySchema {
  type: "select";
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}

export interface RangePropertySchema extends BasePropertySchema {
  type: "range";
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
}

export type PropertySchema =
  | TextareaPropertySchema
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
  schemas: PropertySchema[],
): Record<string, string | number | boolean | Point2D> {
  const defaults: Record<string, string | number | boolean | Point2D> = {};

  for (const schema of schemas) {
    if (schema.defaultValue !== undefined) {
      defaults[schema.key] = schema.defaultValue;
    }
  }

  return defaults;
}

// Generate a Zod schema from PropertySchema for robust runtime validation
export function buildZodSchemaFromProperties(
  schemas: PropertySchema[],
): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const schema of schemas) {
    switch (schema.type) {
      case "number": {
        let validator = z.number();
        if (schema.min !== undefined) validator = validator.min(schema.min);
        if (schema.max !== undefined) validator = validator.max(schema.max);
        shape[schema.key] = validator;
        break;
      }
      case "string":
        shape[schema.key] = z.string();
        break;
      case "color":
        shape[schema.key] = z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/);
        break;
      case "boolean":
        shape[schema.key] = z.boolean();
        break;
      case "point2d":
        shape[schema.key] = z.object({ x: z.number(), y: z.number() });
        break;
      case "select":
        // Accept string or number to accommodate selects that conceptually represent numeric enums (e.g., fps)
        shape[schema.key] = z.union([z.string(), z.number()]);
        break;
      case "range": {
        let validator = z.number();
        validator = validator.min(schema.min).max(schema.max);
        if (schema.step !== undefined) {
          // step validation would be custom; skip strict enforcement to avoid overengineering now
        }
        shape[schema.key] = validator;
        break;
      }
      default:
        // Unknown property types are ignored to maintain strict typing
        break;
    }
  }
  return z.object(shape);
}
