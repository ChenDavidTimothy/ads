// src/shared/properties/system.ts

import { transformFactory } from '@/shared/registry/transforms';
import { getNodeDefinition } from '@/shared/registry/registry-utils';

export const propertySystem = {
  getTransformTargetProperty(type: string): string | undefined {
    return transformFactory.getTransformDefinition(type)?.metadata?.targetProperty;
  },
  getTransformDefinition(type: string) {
    return transformFactory.getTransformDefinition(type);
  },
  getDefaultTransformProperties(type: string) {
    return transformFactory.getDefaultProperties(type);
  },
  getNodeProperties(nodeType: string) {
    return getNodeDefinition(nodeType)?.properties ?? [];
  },
  getNodeDefaults(nodeType: string) {
    return getNodeDefinition(nodeType)?.defaults ?? {};
  },
};

export type PropertySystem = typeof propertySystem;
