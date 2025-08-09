// src/server/animation-processing/execution-context.ts - Future-proof execution context with ID consistency fixes
import type { PortType, SceneAnimationTrack, GeometryProperties } from "@/shared/types";
import type { LogicDataType, TypedValue } from "@/shared/types/validation";
import { validateAndCoerce } from "@/shared/types/validation";

// Expanded data types for future logic nodes
export type ExecutionDataType = 
  | 'object_stream'    // Current: geometry objects
  | 'boolean'          // true/false for logic nodes
  | 'integer'          // numbers for comparisons
  | 'string'           // text data
  | 'array'            // collections
  | 'trigger'          // execution control
  | 'conditional';     // conditional execution paths

export interface ExecutionValue {
  type: PortType;
  data: unknown;
  nodeId: string;
  portId: string;
  metadata?: {
    timestamp?: number;
    conditionalPath?: 'true' | 'false' | 'default';
    priority?: number;
    [key: string]: unknown;
  };
}

// Future-proof execution result for conditional nodes
export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  nextPort?: string;        // For conditional execution (if/else)
  nextPorts?: string[];     // For multi-branch logic
  variables?: Record<string, unknown>; // For setting variables
  error?: string;
}

export interface ExecutionContext {
  // Node outputs stored by nodeId.portId
  nodeOutputs: Map<string, ExecutionValue>;
  
  // Global variables for logic nodes (future-ready)
  variables: Map<string, unknown>;
  
  // Execution state
  executedNodes: Set<string>;
  currentTime: number;
  
  // Conditional execution tracking (future-ready)
  conditionalPaths: Map<string, 'true' | 'false' | 'default'>;
  executionStack: string[]; // For nested conditional execution
  
  // Scene building - properly typed
  sceneObjects: Array<{
    id: string;
    type: 'triangle' | 'circle' | 'rectangle';
    properties: GeometryProperties;
    initialPosition: { x: number; y: number };
    initialRotation?: number;
    initialScale?: { x: number; y: number };
    initialOpacity?: number;
    appearanceTime?: number;
  }>;
  sceneAnimations: SceneAnimationTrack[];

  // Future: Conditional execution metadata
  debugMode?: boolean;
  debugTargetNodeId?: string; // Track specific debug target for selective logging
  executionLog?: Array<{
    nodeId: string;
    timestamp: number;
    action: 'execute' | 'skip' | 'branch';
    data?: unknown;
  }>;
}

export function createExecutionContext(): ExecutionContext {
  return {
    nodeOutputs: new Map(),
    variables: new Map(),
    executedNodes: new Set(),
    currentTime: 0,
    conditionalPaths: new Map(),
    executionStack: [],
    sceneObjects: [],
    sceneAnimations: [],
    debugMode: false,
    executionLog: []
  };
}

export function setNodeOutput(
  context: ExecutionContext,
  nodeId: string,
  portId: string,
  type: PortType,
  data: unknown,
  metadata?: ExecutionValue['metadata']
): void {
  const key = `${nodeId}.${portId}`;
  context.nodeOutputs.set(key, {
    type,
    data,
    nodeId,
    portId,
    metadata: {
      timestamp: Date.now(),
      ...metadata
    }
  });

  // Debug logging (future-ready)
  if (context.debugMode && context.executionLog) {
    context.executionLog.push({
      nodeId,
      timestamp: Date.now(),
      action: 'execute',
      data
    });
  }
}

export function getNodeOutput(
  context: ExecutionContext,
  nodeId: string,
  portId: string
): ExecutionValue | undefined {
  const key = `${nodeId}.${portId}`;
  return context.nodeOutputs.get(key);
}

// CRITICAL FIX: Handle both React Flow IDs and identifier IDs in connection lookups
export function getConnectedInput(
  context: ExecutionContext,
  connections: Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string
): ExecutionValue | undefined {
  // CRITICAL: Try to find connection using identifier ID first, then React Flow ID
  let connection = connections.find(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  if (!connection) {
    // No connection found with this target node ID
    return undefined;
  }
  
  // Get output using the source node identifier ID
  return getNodeOutput(context, connection.source, connection.sourceHandle);
}

export function getConnectedInputs(
  context: ExecutionContext,
  connections: Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string
): ExecutionValue[] {
  // CRITICAL: Find all connections targeting this node/port combination
  const matchingConnections = connections.filter(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  const inputs: ExecutionValue[] = [];
  for (const connection of matchingConnections) {
    // Get output using the source node identifier ID
    const input = getNodeOutput(context, connection.source, connection.sourceHandle);
    if (input) {
      inputs.push(input);
    }
  }
  
  return inputs;
}

// Variable management for future logic nodes
export function setVariable(
  context: ExecutionContext,
  name: string,
  value: unknown
): void {
  context.variables.set(name, value);

  if (context.debugMode && context.executionLog) {
    context.executionLog.push({
      nodeId: 'system',
      timestamp: Date.now(),
      action: 'execute',
      data: { variableSet: name, value }
    });
  }
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

// Future: Conditional execution support
export function setConditionalPath(
  context: ExecutionContext,
  nodeId: string,
  path: 'true' | 'false' | 'default'
): void {
  context.conditionalPaths.set(nodeId, path);
}

export function getConditionalPath(
  context: ExecutionContext,
  nodeId: string
): 'true' | 'false' | 'default' | undefined {
  return context.conditionalPaths.get(nodeId);
}

export function pushExecutionStack(
  context: ExecutionContext,
  nodeId: string
): void {
  context.executionStack.push(nodeId);
}

export function popExecutionStack(
  context: ExecutionContext
): string | undefined {
  return context.executionStack.pop();
}

// Future: Debug utilities
export function enableDebugMode(context: ExecutionContext): void {
  context.debugMode = true;
  context.executionLog ??= [];
}

export function getExecutionLog(context: ExecutionContext): typeof context.executionLog {
  return context.executionLog ?? [];
}

// Future: Type validation for logic nodes
export function validateExecutionValue(
  value: unknown,
  expectedType: ExecutionDataType
): boolean {
  switch (expectedType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'string':
      return typeof value === 'string';
    case 'array':
      return Array.isArray(value);
    case 'object_stream':
      return Array.isArray(value) || (typeof value === 'object' && value !== null);
    case 'trigger':
      return value === true || value === null || value === undefined;
    case 'conditional':
      return typeof value === 'boolean' || typeof value === 'string';
    default:
      return true; // Unknown types pass through
  }
}

// Future: Convert execution value to specific type
export function coerceExecutionValue(
  value: unknown,
  targetType: ExecutionDataType
): unknown {
  switch (targetType) {
    case 'boolean':
      return Boolean(value);
    case 'integer':
      return typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10);
    case 'string':
      return String(value);
    case 'array':
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
}

// Type-aware helper functions for logic nodes
export function getTypedConnectedInput<T>(
  context: ExecutionContext,
  connections: Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string,
  expectedType: LogicDataType
): TypedValue<T> | undefined {
  const input = getConnectedInput(context, connections, targetNodeId, targetPortId);
  if (!input) return undefined;
  
  return validateAndCoerce<T>(input.data, expectedType, {
    nodeId: targetNodeId,
    portId: targetPortId,
    sourceNodeId: input.nodeId
  });
}

export function getTypedConnectedInputs<T>(
  context: ExecutionContext,
  connections: Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
  targetNodeId: string,
  targetPortId: string,
  expectedType: LogicDataType
): TypedValue<T>[] {
  const inputs = getConnectedInputs(context, connections, targetNodeId, targetPortId);
  
  return inputs.map(input => 
    validateAndCoerce<T>(input.data, expectedType, {
      nodeId: targetNodeId,
      portId: targetPortId,
      sourceNodeId: input.nodeId
    })
  );
}