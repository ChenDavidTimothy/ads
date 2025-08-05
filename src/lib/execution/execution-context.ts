// src/lib/execution/execution-context.ts
import type { PortType } from "../types/ports";
import type { SceneAnimationTrack } from "@/animation/scene/types";

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