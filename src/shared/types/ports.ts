// src/shared/types/ports.ts
export type PortType = 
  | 'object'        // Geometry objects
  | 'timed_object'  // Objects with timing applied by Insert node
  | 'animation'     // Animation timeline
  | 'data'         // Generic data
  | 'boolean'      // True/false values
  | 'trigger'      // Execution trigger
  | 'scene';       // Final scene output

export interface PortDefinition {
  id: string;
  type: PortType;
  label: string;
  required?: boolean;
}

export interface NodePortConfig {
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

export interface TypedConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  sourcePortType: PortType;
  targetPortType: PortType;
}

// Base port compatibility rules
const PORT_COMPATIBILITY: Record<PortType, PortType[]> = {
  object: ['object', 'data'],
  timed_object: ['timed_object', 'data'],
  animation: ['animation', 'scene', 'data'],
  data: ['data', 'boolean', 'trigger'],
  boolean: ['boolean', 'trigger', 'data'],
  trigger: ['trigger', 'animation', 'data'],
  scene: ['scene']
};

export function arePortsCompatible(
  sourceType: PortType, 
  targetType: PortType
): boolean {
  return PORT_COMPATIBILITY[sourceType]?.includes(targetType) ?? false;
}