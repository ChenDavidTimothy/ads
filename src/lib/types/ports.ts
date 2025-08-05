// src/lib/types/ports.ts
export type PortType = 
  | 'object'        // Geometry objects
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

// Port compatibility rules
export const PORT_COMPATIBILITY: Record<PortType, PortType[]> = {
  object: ['object', 'animation', 'data'],
  animation: ['animation', 'object', 'scene', 'data'], // Animation can connect to object (smart ports)
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