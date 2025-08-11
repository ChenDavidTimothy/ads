// src/shared/registry/transform-definitions.ts - Transform definitions registry
import type { TransformDefinition } from '../types/transforms';

// Complete transform definitions with all metadata - follows NodeDefinition pattern
export const TRANSFORM_DEFINITIONS: Record<string, TransformDefinition> = {
  move: {
    type: 'move',
    label: 'Move',
    description: 'Move object from one position to another',
    category: 'movement',
    properties: [
      {
        key: 'from',
        type: 'point2d',
        label: 'From Position',
        description: 'Starting position of the object',
        defaultValue: { x: 0, y: 0 },
        required: true,
      },
      {
        key: 'to',
        type: 'point2d',
        label: 'To Position',
        description: 'Ending position of the object',
        defaultValue: { x: 100, y: 100 },
        required: true,
      },
    ],
    defaults: {
      from: { x: 0, y: 0 },
      to: { x: 100, y: 100 },
    },
    metadata: {
      supportsEasing: true,
      defaultEasing: 'easeInOut',
    },
  },

  rotate: {
    type: 'rotate',
    label: 'Rotate',
    description: 'Rotate object by specified number of rotations',
    category: 'transformation',
    properties: [
      {
        key: 'rotations',
        type: 'number',
        label: 'Rotations',
        description: 'Number of full rotations (1 = 360°, 0.5 = 180°)',
        defaultValue: 1,
        required: true,
        constraints: {
          min: -10,
          max: 10,
          step: 0.1,
        },
      },
    ],
    defaults: {
      rotations: 1,
    },
    metadata: {
      supportsEasing: true,
      defaultEasing: 'linear',
    },
  },

  scale: {
    type: 'scale',
    label: 'Scale',
    description: 'Scale object from one size to another',
    category: 'transformation',
    properties: [
      {
        key: 'from',
        type: 'number',
        label: 'From Scale',
        description: 'Starting scale value (1 = 100%)',
        defaultValue: 1,
        required: true,
        constraints: {
          min: 0.1,
          max: 10,
          step: 0.1,
        },
      },
      {
        key: 'to',
        type: 'number',
        label: 'To Scale',
        description: 'Ending scale value (1 = 100%)',
        defaultValue: 1.5,
        required: true,
        constraints: {
          min: 0.1,
          max: 10,
          step: 0.1,
        },
      },
    ],
    defaults: {
      from: 1,
      to: 1.5,
    },
    metadata: {
      supportsEasing: true,
      defaultEasing: 'easeInOut',
    },
  },

  fade: {
    type: 'fade',
    label: 'Fade',
    description: 'Change object opacity from one value to another',
    category: 'appearance',
    properties: [
      {
        key: 'from',
        type: 'number',
        label: 'From Opacity',
        description: 'Starting opacity (0 = transparent, 1 = opaque)',
        defaultValue: 1,
        required: true,
        constraints: {
          min: 0,
          max: 1,
          step: 0.1,
        },
      },
      {
        key: 'to',
        type: 'number',
        label: 'To Opacity',
        description: 'Ending opacity (0 = transparent, 1 = opaque)',
        defaultValue: 0.5,
        required: true,
        constraints: {
          min: 0,
          max: 1,
          step: 0.1,
        },
      },
    ],
    defaults: {
      from: 1,
      to: 0.5,
    },
    metadata: {
      supportsEasing: true,
      defaultEasing: 'easeInOut',
    },
  },

  color: {
    type: 'color',
    label: 'Color',
    description: 'Change object fill or stroke color',
    category: 'appearance',
    properties: [
      {
        key: 'from',
        type: 'color',
        label: 'From Color',
        description: 'Starting color',
        defaultValue: '#ff0000',
        required: true,
      },
      {
        key: 'to',
        type: 'color',
        label: 'To Color',
        description: 'Ending color',
        defaultValue: '#00ff00',
        required: true,
      },
      {
        key: 'property',
        type: 'string',
        label: 'Property',
        description: 'Which color property to animate',
        defaultValue: 'fill',
        required: true,
        constraints: {
          options: ['fill', 'stroke'],
        },
      },
    ],
    defaults: {
      from: '#ff0000',
      to: '#00ff00',
      property: 'fill',
    },
    metadata: {
      supportsEasing: true,
      defaultEasing: 'easeInOut',
    },
  },
};

// Derive TransformType from registry to avoid duplication elsewhere
export type TransformType = keyof typeof TRANSFORM_DEFINITIONS;

// Validation helpers
export function isValidTransformType(transformType: string): transformType is TransformType {
  return transformType in TRANSFORM_DEFINITIONS;
}

export function getTransformDefinition(transformType: string): TransformDefinition | undefined {
  return TRANSFORM_DEFINITIONS[transformType];
}

export function getAllTransformTypes(): TransformType[] {
  return Object.keys(TRANSFORM_DEFINITIONS) as TransformType[];
}

export function getTransformsByCategory(category: TransformDefinition['category']): TransformDefinition[] {
  return Object.values(TRANSFORM_DEFINITIONS).filter(def => def.category === category);
}

// Get default properties for a transform type
export function getTransformDefaults(transformType: string): Record<string, unknown> | undefined {
  const definition = getTransformDefinition(transformType);
  return definition?.defaults;
}

// Get transform metadata
export function getTransformMetadata(transformType: string) {
  const definition = getTransformDefinition(transformType);
  return definition?.metadata;
}

// Get default properties (alias for getTransformDefaults for backward compatibility)
export function getDefaultProperties(type: string): Record<string, unknown> | undefined {
  return getTransformDefaults(type);
}