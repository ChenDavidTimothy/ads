// src/shared/types/ports.ts - Enhanced port system for visual programming
export type PortType = 
  | 'object_stream'  // Universal stream - connects to everything, carries any object data
  | 'data'          // Generic data
  | 'boolean'       // True/false values  
  | 'trigger'       // Execution trigger
  | 'scene'         // Final scene output
  // Future logic node types
  | 'number'        // Numeric values for math operations
  | 'string'        // Text data for string operations  
  | 'condition'     // Conditional outputs (true/false branches)
  | 'array'         // Collections/lists
  | 'any';          // Dynamic typing for generic operations

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

// Enhanced port compatibility matrix - future-ready while preserving current behavior
const PORT_COMPATIBILITY: Record<PortType, PortType[]> = {
  // Current behavior - object_stream is universal connector
  object_stream: ['object_stream', 'data', 'scene', 'any'], 
  data: ['data', 'object_stream', 'boolean', 'trigger', 'number', 'string', 'array', 'any'],
  boolean: ['boolean', 'trigger', 'data', 'object_stream', 'condition', 'any'],
  trigger: ['trigger', 'data', 'object_stream', 'any'], 
  scene: ['scene'], // Scene is terminal - only accepts input
  
  // Future logic node compatibility
  number: ['number', 'data', 'any', 'string'], // Numbers can convert to string
  string: ['string', 'data', 'any'], 
  condition: ['condition', 'boolean', 'data', 'any'], // Conditions are boolean-like
  array: ['array', 'data', 'any'],
  any: ['any', 'data', 'object_stream', 'boolean', 'trigger', 'number', 'string', 'condition', 'array'] // Any connects to everything
};

export function arePortsCompatible(
  sourceType: PortType, 
  targetType: PortType
): boolean {
  return PORT_COMPATIBILITY[sourceType]?.includes(targetType) ?? false;
}

// Future: Port validation for logic operations
export function validatePortDataType(data: unknown, portType: PortType): boolean {
  switch (portType) {
    case 'boolean':
    case 'condition':
      return typeof data === 'boolean';
    case 'number':
      return typeof data === 'number';
    case 'string':
      return typeof data === 'string';
    case 'array':
      return Array.isArray(data);
    case 'object_stream':
    case 'data':
      return Array.isArray(data) || (typeof data === 'object' && data !== null);
    case 'any':
    case 'trigger':
      return true; // Any data or no data validation
    case 'scene':
      return typeof data === 'object' && data !== null;
    default:
      return true;
  }
}