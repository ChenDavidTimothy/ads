// src/lib/execution/execution-context.ts
import type { PortType } from "../types/ports";

export interface ExecutionValue {
  type: PortType;
  data: any;
  nodeId: string;
  portId: string;
}

export interface ExecutionContext {
  // Node outputs stored by nodeId.portId
  nodeOutputs: Map<string, ExecutionValue>;
  
  // Global variables for logic nodes
  variables: Map<string, any>;
  
  // Execution state
  executedNodes: Set<string>;
  currentTime: number;
  
  // Scene building
  sceneObjects: any[];
  sceneAnimations: any[];
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
  data: any
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
  connections: any[],
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
  value: any
): void {
  context.variables.set(name, value);
}

export function getVariable(
  context: ExecutionContext,
  name: string
): any {
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