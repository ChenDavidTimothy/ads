// src/lib/execution/execution-context.ts
import type { PortType } from "../types/ports";
import type { SceneAnimationTrack } from "@/animation/scene/types";
import type { FlowTracker } from "../flow/flow-tracking";

export interface ExecutionValue {
  type: PortType;
  data: unknown;
  nodeId: string;
  portId: string;
}

export interface ExecutionContext {
  nodeOutputs: Map<string, ExecutionValue>;
  variables: Map<string, unknown>;
  executedNodes: Set<string>;
  currentTime: number;
  
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

// CRITICAL FIX: Respect edge filtering for "river flow" behavior
export function getFilteredConnectedInputs(
  context: ExecutionContext,
  connections: Array<{ id: string; target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string,
  flowTracker: FlowTracker
): ExecutionValue[] {
  const matchingConnections = connections.filter(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  const filteredInputs: ExecutionValue[] = [];
  
  for (const connection of matchingConnections) {
    const allowedNodeIds = flowTracker.getNodesFlowingThroughEdge(connection.id);
    
    const sourceOutput = getNodeOutput(context, connection.source, connection.sourceHandle);
    if (!sourceOutput) continue;
    
    // Filter the data based on edge filtering
    const filteredData = filterDataByAllowedNodes(sourceOutput.data, allowedNodeIds);
    
    if (filteredData !== null) {
      filteredInputs.push({
        ...sourceOutput,
        data: filteredData
      });
    }
  }
  
  return filteredInputs;
}

// Filter output data to only include allowed nodes
function filterDataByAllowedNodes(data: unknown, allowedNodeIds: string[]): unknown {
  if (!data) return null;
  
  // Handle arrays of objects (common case)
  if (Array.isArray(data)) {
    const filtered = data.filter(item => {
      if (typeof item === 'object' && item !== null && 'id' in item) {
        return allowedNodeIds.includes(item.id as string);
      }
      return true; // Non-object data passes through
    });
    return filtered.length > 0 ? filtered : null;
  }
  
  // Handle single object
  if (typeof data === 'object' && data !== null && 'id' in data) {
    return allowedNodeIds.includes((data as { id: string }).id) ? data : null;
  }
  
  // Non-object data passes through unchanged
  return data;
}

// Legacy function for backward compatibility - redirects to filtered version
export function getConnectedInputs(
  context: ExecutionContext,
  connections: Array<{ id: string; target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string
): ExecutionValue[] {
  // Fallback for when flowTracker is not available
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

export function getConnectedInput(
  context: ExecutionContext,
  connections: Array<{ id: string; target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string
): ExecutionValue | undefined {
  const connection = connections.find(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  if (!connection) return undefined;
  
  return getNodeOutput(context, connection.source, connection.sourceHandle);
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