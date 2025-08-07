// src/server/animation-processing/execution-context.ts - Fixed filtering logic for port types
import type { PortType, SceneAnimationTrack } from "@/shared/types";

export interface ExecutionValue {
  type: PortType;
  data: unknown;
  nodeId: string;
  portId: string;
}

export interface ExecutionContext {
  // Node outputs stored by nodeId.portId
  nodeOutputs: Map<string, ExecutionValue>;
  
  // Global variables for logic nodes
  variables: Map<string, unknown>;
  
  // Execution state
  executedNodes: Set<string>;
  currentTime: number;
  
  // Edge filtering data - maps edgeId to selectedNodeIds array
  edgeFiltering: Map<string, string[]>;
  
  // Scene building - now properly typed
  sceneObjects: Array<{
    id: string;
    type: 'triangle' | 'circle' | 'rectangle';
    properties: Record<string, unknown>;
    initialPosition: { x: number; y: number };
    initialRotation?: number;
    initialScale?: { x: number; y: number };
    initialOpacity?: number;
    appearanceTime?: number;
  }>;
  sceneAnimations: SceneAnimationTrack[];
}

export function createExecutionContext(): ExecutionContext {
  return {
    nodeOutputs: new Map(),
    variables: new Map(),
    executedNodes: new Set(),
    currentTime: 0,
    edgeFiltering: new Map(),
    sceneObjects: [],
    sceneAnimations: []
  };
}

export function setNodeOutput(
  context: ExecutionContext,
  nodeId: string,
  portId: string,
  type: PortType,
  data: unknown
): void {
  const key = `${nodeId}.${portId}`;
  context.nodeOutputs.set(key, {
    type,
    data,
    nodeId,
    portId
  });
}

export function getNodeOutput(
  context: ExecutionContext,
  nodeId: string,
  portId: string
): ExecutionValue | undefined {
  const key = `${nodeId}.${portId}`;
  return context.nodeOutputs.get(key);
}

export function getConnectedInput(
  context: ExecutionContext,
  connections: Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string
): ExecutionValue | undefined {
  const connection = connections.find(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  if (!connection) return undefined;
  
  return getNodeOutput(context, connection.source, connection.sourceHandle);
}

export function getConnectedInputs(
  context: ExecutionContext,
  connections: Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string
): ExecutionValue[] {
  const matchingConnections = connections.filter(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  const inputs: ExecutionValue[] = [];
  for (const connection of matchingConnections) {
    const input = getNodeOutput(context, connection.source, connection.sourceHandle);
    if (input) {
      inputs.push(input);
    }
  }
  
  return inputs;
}

// FIXED: Get filtered connected inputs with proper port type checking
export function getFilteredConnectedInputs(
  context: ExecutionContext,
  connections: Array<{ 
    id: string; 
    target: string; 
    targetHandle: string; 
    source: string; 
    sourceHandle: string 
  }>,
  targetNodeId: string,
  targetPortId: string
): ExecutionValue[] {
  const matchingConnections = connections.filter(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  const inputs: ExecutionValue[] = [];
  for (const connection of matchingConnections) {
    const input = getNodeOutput(context, connection.source, connection.sourceHandle);
    if (!input) continue;
    
    // CRITICAL FIX: Only apply selectedNodeIds filtering to object and timed_object types
    if (input.type !== 'object' && input.type !== 'timed_object') {
      // For non-object types (animation, data, boolean, trigger, scene, etc.), pass through unfiltered
      inputs.push(input);
      continue;
    }
    
    // Check if this edge has filtering configuration
    const selectedNodeIds = context.edgeFiltering.get(connection.id);
    
    if (selectedNodeIds === undefined) {
      // No filtering specified - allow all objects through (backward compatibility)
      inputs.push(input);
      continue;
    }
    
    // Apply filtering logic based on selectedNodeIds
    if (selectedNodeIds.length === 0) {
      // Empty selection - no objects flow through this edge
      continue;
    }
    
    // Filter the input data based on selectedNodeIds
    const filteredInput = filterInputData(input, selectedNodeIds);
    if (filteredInput) {
      inputs.push(filteredInput);
    }
  }
  
  return inputs;
}

// Helper function to filter input data based on selectedNodeIds - Enhanced for robustness
function filterInputData(input: ExecutionValue, selectedNodeIds: string[]): ExecutionValue | null {
  if (Array.isArray(input.data)) {
    // Filter array of objects - only include objects whose IDs are in selectedNodeIds
    const filteredData = input.data.filter((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        // Handle both simple 'id' property and nested 'identifier.id' structure
        if ('id' in item) {
          return selectedNodeIds.includes((item as { id: string }).id);
        } else if ('identifier' in item && 
                   typeof (item as { identifier: unknown }).identifier === 'object' && 
                   (item as { identifier: unknown }).identifier !== null &&
                   'id' in ((item as { identifier: { id: string } }).identifier)) {
          return selectedNodeIds.includes((item as { identifier: { id: string } }).identifier.id);
        }
      }
      return false;
    });
    
    // Return null if no objects pass the filter
    if (filteredData.length === 0) {
      return null;
    }
    
    return {
      ...input,
      data: filteredData
    };
  } else {
    // Single object - include only if its ID is in selectedNodeIds
    if (typeof input.data === 'object' && input.data !== null) {
      let objectId: string | undefined;
      
      // Handle both simple 'id' property and nested 'identifier.id' structure
      if ('id' in input.data) {
        objectId = (input.data as { id: string }).id;
      } else if ('identifier' in input.data && 
                 typeof (input.data as { identifier: unknown }).identifier === 'object' && 
                 (input.data as { identifier: unknown }).identifier !== null &&
                 'id' in ((input.data as { identifier: { id: string } }).identifier)) {
        objectId = (input.data as { identifier: { id: string } }).identifier.id;
      }
      
      if (objectId && selectedNodeIds.includes(objectId)) {
        return input;
      }
    }
    
    // Object not selected - exclude entirely
    return null;
  }
}

export function setVariable(
  context: ExecutionContext,
  name: string,
  value: unknown
): void {
  context.variables.set(name, value);
}

export function getVariable(
  context: ExecutionContext,
  name: string
): unknown {
  return context.variables.get(name);
}

export function markNodeExecuted(
  context: ExecutionContext,
  nodeId: string
): void {
  context.executedNodes.add(nodeId);
}

export function isNodeExecuted(
  context: ExecutionContext,
  nodeId: string
): boolean {
  return context.executedNodes.has(nodeId);
}

// Set edge filtering configuration
export function setEdgeFiltering(
  context: ExecutionContext,
  edgeId: string,
  selectedNodeIds: string[]
): void {
  context.edgeFiltering.set(edgeId, selectedNodeIds);
}