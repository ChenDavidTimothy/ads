// src/lib/types/ports.ts - Updated to support AnimationNode chaining
export type PortType = 
  | 'object'        // Geometry objects
  | 'timed_object'  // Objects with timing applied by Insert node
  | 'animation'     // Animation timeline - now can chain with other animations
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

// Path filtering for exclusive routing
export interface PathFilter {
  selectedObjectIds: string[];
  filterEnabled: boolean;
}

export interface FilteredConnection extends TypedConnection {
  pathFilter?: PathFilter;
}

// Updated port compatibility rules - CRITICAL: Enable animation chaining
const PORT_COMPATIBILITY: Record<PortType, PortType[]> = {
  object: ['object', 'data'],
  timed_object: ['timed_object', 'data'],
  animation: ['animation', 'timed_object', 'scene', 'data'], // Key change: animation can connect to animation
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

// Helper to determine if a port accepts multiple input types
export function getAcceptedInputTypes(targetType: PortType): PortType[] {
  const acceptedTypes: PortType[] = [];
  
  for (const [sourceType, compatibleTargets] of Object.entries(PORT_COMPATIBILITY)) {
    if (compatibleTargets.includes(targetType)) {
      acceptedTypes.push(sourceType as PortType);
    }
  }
  
  return acceptedTypes;
}