// src/shared/registry/transform-factory.ts - Transform factory implementation
import type {
  TransformFactory,
  AnimationTransform,
  SceneTransform,
  TransformDefinition,
  PropertyDefinition,
  PropertyType,
} from "../types/transforms";
import type { TransformIdentifier } from "../types/transforms";
import type { AnimationTrack } from "../types/nodes";
import {
  generateTransformIdentifier,
  validateTransformDisplayName,
} from "@/lib/defaults/transforms";
import { TRANSFORM_DEFINITIONS } from "./transform-definitions";
import {
  INTERPOLATOR_REGISTRY,
  getInterpolator,
  canInterpolate,
} from "./interpolator-registry";

// Mutable registry copy to allow runtime registration of new transforms
const REGISTRY: Record<string, TransformDefinition> = {
  ...TRANSFORM_DEFINITIONS,
};

export class TransformFactoryImpl implements TransformFactory {
  // Create a short, lint-safe preview string for error messages
  private createValuePreview(value: unknown, depth = 0): string {
    if (depth > 2) return "{...}";
    if (value === null) return "null";
    const t = typeof value;
    switch (t) {
      case "string":
        return JSON.stringify(value);
      case "number":
        return Number.isFinite(value as number)
          ? (value as number).toString()
          : "NaN";
      case "boolean":
        return (value as boolean) ? "true" : "false";
      case "bigint":
        return (value as bigint).toString();
      case "symbol":
        return (value as symbol).description
          ? `Symbol(${(value as symbol).description})`
          : "Symbol()";
      case "function":
        return "{function}";
      case "object": {
        if (Array.isArray(value)) {
          const items = value
            .slice(0, 5)
            .map((v) => this.createValuePreview(v, depth + 1));
          const suffix = value.length > 5 ? ", ..." : "";
          return `[${items.join(", ")}${suffix}]`;
        }
        try {
          return JSON.stringify(value);
        } catch {
          return "{object}";
        }
      }
      default:
        return "{unknown}";
    }
  }

  // Register a new transform definition at runtime
  registerTransform(definition: TransformDefinition): void {
    REGISTRY[definition.type] = definition;
  }

  // Create a transform instance from type and properties
  createTransform(
    type: string,
    properties: Record<string, unknown>,
  ): AnimationTransform {
    const definition = this.getTransformDefinition(type);
    if (!definition) {
      throw new Error(`Unknown transform type: ${type}`);
    }

    // Validate and merge properties with defaults
    const validatedProperties = this.validateAndMergeProperties(
      definition,
      properties,
    );

    // This factory method is used for scene-time transforms, not editor tracks.
    // ID remains a simple ephemeral value as it is not used as canonical track ID.
    return {
      id: `${type}-${Date.now()}`,
      type,
      startTime: 0,
      duration: 2,
      easing: this.getDefaultEasing(definition.type),
      properties: validatedProperties,
    };
  }

  // Create a scene transform from an animation transform
  createSceneTransform(
    transform: AnimationTransform,
    objectId: string,
    baselineTime: number,
  ): SceneTransform {
    return {
      objectId,
      type: transform.type,
      startTime: baselineTime + transform.startTime,
      duration: transform.duration,
      easing: transform.easing,
      properties: transform.properties,
    };
  }

  // Validate transform properties against their definition
  validateTransform(
    type: string,
    properties: Record<string, unknown>,
  ): boolean {
    const definition = this.getTransformDefinition(type);
    if (!definition) {
      return false;
    }

    try {
      this.validateAndMergeProperties(definition, properties);
      return true;
    } catch {
      return false;
    }
  }

  // Get transform definition by type
  getTransformDefinition(type: string): TransformDefinition | undefined {
    return REGISTRY[type];
  }

  // Get all available transform types
  getAllTransformTypes(): string[] {
    return Object.keys(REGISTRY);
  }

  // Get transforms by category
  getTransformsByCategory(
    category: TransformDefinition["category"],
  ): TransformDefinition[] {
    return Object.values(REGISTRY).filter((def) => def.category === category);
  }

  // Get track colors for UI rendering
  getTrackColors(): Record<string, string> {
    const colors: Record<string, string> = {};
    for (const [type, definition] of Object.entries(REGISTRY)) {
      if (definition.metadata?.trackColor) {
        colors[type] = definition.metadata.trackColor;
      }
    }
    return colors;
  }

  // Get track icons for UI rendering
  getTrackIcons(): Record<string, string> {
    const icons: Record<string, string> = {};
    for (const [type, definition] of Object.entries(REGISTRY)) {
      if (definition.metadata?.trackIcon) {
        icons[type] = definition.metadata.trackIcon;
      }
    }
    return icons;
  }

  // Get default properties for a transform type
  getDefaultProperties(type: string): Record<string, unknown> | undefined {
    const definition = this.getTransformDefinition(type);
    return definition?.defaults;
  }

  // Get property definitions for a transform type
  getPropertyDefinitions(type: string): PropertyDefinition[] {
    const definition = this.getTransformDefinition(type);
    return definition?.properties ?? [];
  }

  // Check if a transform type supports easing
  supportsEasing(type: string): boolean {
    const definition = this.getTransformDefinition(type);
    return definition?.metadata?.supportsEasing ?? false;
  }

  // Get default easing for a transform type
  getDefaultEasing(
    type: string,
  ): "linear" | "easeInOut" | "easeIn" | "easeOut" {
    const definition = this.getTransformDefinition(type);
    const easing = definition?.metadata?.defaultEasing;
    return easing ?? "linear";
  }

  // Validate and merge properties with defaults
  private validateAndMergeProperties(
    definition: TransformDefinition,
    properties: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...definition.defaults };

    for (const propDef of definition.properties) {
      const providedValue = properties[propDef.key];

      if (providedValue !== undefined) {
        // Validate the provided value
        if (!this.validatePropertyValue(propDef, providedValue)) {
          const valueRepr = this.createValuePreview(providedValue);
          throw new Error(
            `Invalid value for property ${propDef.key}: ${valueRepr}`,
          );
        }
        result[propDef.key] = providedValue;
      } else if (propDef.required) {
        // Use default value for required properties
        result[propDef.key] = propDef.defaultValue;
      }
    }

    return result;
  }

  // Validate a single property value
  private validatePropertyValue(
    propDef: PropertyDefinition,
    value: unknown,
  ): boolean {
    // Type validation
    if (!this.validatePropertyType(propDef.type, value)) {
      return false;
    }

    // Constraint validation
    if (
      propDef.constraints &&
      !this.validatePropertyConstraints(propDef.constraints, value)
    ) {
      return false;
    }

    return true;
  }

  // Validate property type
  private validatePropertyType(type: PropertyType, value: unknown): boolean {
    switch (type) {
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "point2d":
        if (typeof value !== "object" || value === null) return false;
        const point = value as Record<string, unknown>;
        return typeof point.x === "number" && typeof point.y === "number";
      case "color":
        return (
          typeof value === "string" &&
          (value.startsWith("#") || value.startsWith("rgb"))
        );
      case "string":
        return typeof value === "string";
      case "boolean":
        return typeof value === "boolean";
      default:
        return false;
    }
  }

  // Validate property constraints
  private validatePropertyConstraints(
    constraints: PropertyDefinition["constraints"],
    value: unknown,
  ): boolean {
    if (!constraints) return true;
    if (typeof value !== "number") return true; // Only numbers have constraints for now

    if (constraints.min !== undefined && value < constraints.min) {
      return false;
    }
    if (constraints.max !== undefined && value > constraints.max) {
      return false;
    }
    if (
      constraints.options !== undefined &&
      !constraints.options.includes(String(value))
    ) {
      return false;
    }

    return true;
  }

  // Get interpolator for a property
  getPropertyInterpolator(propertyType: PropertyType) {
    return getInterpolator(propertyType);
  }

  // Check if a value can be interpolated
  canInterpolateValue(value: unknown): boolean {
    return canInterpolate(value);
  }

  // Get all property types that support interpolation
  getInterpolatablePropertyTypes(): PropertyType[] {
    return Object.keys(INTERPOLATOR_REGISTRY) as PropertyType[];
  }

  // ----- Enhancements for identifier & naming (non-breaking) -----

  generateIdentifier(
    type: string,
    existingTracks: AnimationTrack[],
  ): TransformIdentifier {
    return generateTransformIdentifier(type, existingTracks);
  }

  validateTransformDisplayName(
    newName: string,
    currentTrackId: string,
    allTracks: AnimationTrack[],
  ): string | null {
    return validateTransformDisplayName(newName, currentTrackId, allTracks);
  }
}

// Export singleton instance
export const transformFactory = new TransformFactoryImpl();

// Export singleton instance only - other functions are exported from transform-definitions.ts
