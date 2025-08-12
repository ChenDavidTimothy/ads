// src/shared/registry/transform-validation.ts - Validate transform definition registry
import { TRANSFORM_DEFINITIONS } from './transform-definitions';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateTransformRegistry(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [type, def] of Object.entries(TRANSFORM_DEFINITIONS)) {
    if (!def.label || !def.description) {
      errors.push(`Transform ${type} missing required label/description`);
    }
    if (!def.defaults) {
      errors.push(`Transform ${type} missing defaults`);
    }
    if (!def.properties || def.properties.length === 0) {
      warnings.push(`Transform ${type} has no properties defined`);
    }
    if (!def.metadata?.trackColor) {
      warnings.push(`Transform ${type} missing metadata.trackColor`);
    }
    if (!def.metadata?.trackIcon) {
      warnings.push(`Transform ${type} missing metadata.trackIcon`);
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}


