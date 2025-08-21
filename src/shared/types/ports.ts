// src/shared/types/ports.ts - Simplified with object_stream as universal type
export type PortType =
  | "object_stream" // Universal stream - connects to everything, carries any object data
  | "data" // Generic data
  | "boolean" // True/false values
  | "trigger" // Execution trigger
  | "scene"; // Final scene output

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

// Edge kind to distinguish control-flow vs data-flow
export type EdgeKind = "data" | "control";

export interface TypedConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  sourcePortType: PortType;
  targetPortType: PortType;
  kind?: EdgeKind;
}

// Simplified port compatibility - object_stream is universal
const PORT_COMPATIBILITY: Record<PortType, PortType[]> = {
  object_stream: ["object_stream", "data", "scene"], // Universal - connects to most types
  data: ["data", "object_stream", "boolean", "trigger"],
  boolean: ["boolean", "trigger", "data", "object_stream"],
  trigger: ["trigger", "data", "object_stream"],
  scene: ["scene"], // Scene is terminal - only accepts input
};

export function arePortsCompatible(
  sourceType: PortType,
  targetType: PortType,
): boolean {
  return PORT_COMPATIBILITY[sourceType]?.includes(targetType) ?? false;
}
