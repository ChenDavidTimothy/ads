// src/server/animation-processing/execution-context.ts - Updated with FlowTracker support
import type { PortType, SceneAnimationTrack } from "@/shared/types";
import type { FlowTrackerData } from "./execution-engine";

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
  
  // Scene building - properly typed
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
  
  // NEW: FlowTracker data for edge filtering
  flowTrackerData?: FlowTrackerData;
}

export function createExecutionContext(): ExecutionContext {
  return {
    nodeOutputs: new Map(),
    variables: new Map(),
    executedNodes: new Set(),
    currentTime: 0,
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

// NEW: Filtered connected inputs using FlowTracker data
export function getFilteredConnectedInputs(
  context: ExecutionContext,
  connections: Array<{id: string; target: string; targetHandle: string; source: string; sourceHandle: string}>,
  targetNodeId: string,
  targetPortId: string
): ExecutionValue[] {
  const matchingConnections = connections.filter(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  const filteredInputs: ExecutionValue[] = [];
  
  for (const connection of matchingConnections) {
    const edgeId = connection.id;
    const flowData = context.flowTrackerData?.[edgeId];
    
    const rawInput = getNodeOutput(context, connection.source, connection.sourceHandle);
    if (!rawInput) continue;
    
    // Determine which objects should be processed
    let nodesToProcess: string[];
    
    if (!flowData || !context.flowTrackerData) {
      // No flowData or no FlowTracker data at all (backwards compatibility)
      // Process ALL available objects from the raw input
      nodesToProcess = extractObjectIds(rawInput.data);
    } else {
      // FlowData exists, use selectedNodeIds 
      // If empty array, nothing flows through this specific edge
      nodesToProcess = flowData.selectedNodeIds;
    }
    
    const filteredData = filterInputBySelection(rawInput, nodesToProcess);
    
    // Always add the input, even if filtered data is empty/null
    // This preserves the connection structure for proper execution
    filteredInputs.push({
      ...rawInput,
      data: filteredData
    });
  }
  
  return filteredInputs;
}

// Extract object IDs from input data for backwards compatibility
function extractObjectIds(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data
      .filter((item: any) => item && typeof item.id === 'string')
      .map((item: any) => item.id);
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as any;
    return obj.id && typeof obj.id === 'string' ? [obj.id] : [];
  }
  return [];
}

// Filter input data by selected node IDs
function filterInputBySelection(input: ExecutionValue, selectedNodeIds: string[]): unknown {
  if (selectedNodeIds.length === 0) {
    // Empty selection = nothing flows
    return Array.isArray(input.data) ? [] : null;
  }
  
  if (Array.isArray(input.data)) {
    // Filter array of objects by their IDs
    return input.data.filter((item: any) => 
      item && typeof item.id === 'string' && selectedNodeIds.includes(item.id)
    );
  } else if (typeof input.data === 'object' && input.data !== null) {
    // Single object - include if selected
    const obj = input.data as any;
    if (obj.id && typeof obj.id === 'string' && selectedNodeIds.includes(obj.id)) {
      return obj;
    }
    return null;
  }
  
  // For non-object data, pass through if any selection exists
  return selectedNodeIds.length > 0 ? input.data : null;
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