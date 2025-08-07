// src/server/animation-processing/execution-context.ts - Enhanced execution context for visual programming
import type { PortType, SceneAnimationTrack } from "@/shared/types";

// Enhanced data types for future logic nodes
export type ExecutionDataType = 
  | 'object_stream'    // Current: geometry objects
  | 'boolean'          // true/false for logic nodes
  | 'number'           // numeric values for math operations
  | 'string'           // text data for string operations
  | 'array'            // collections/lists
  | 'trigger'          // execution control
  | 'conditional'      // conditional execution paths
  | 'any';             // dynamic typing

export interface ExecutionValue {
  type: PortType;
  data: unknown;
  nodeId: string;
  portId: string;
  metadata?: {
    timestamp?: number;
    conditionalPath?: 'true' | 'false' | 'default';
    priority?: number;
    sourceExpression?: string; // For debugging complex expressions
    [key: string]: unknown;
  };
}

// Enhanced execution result for conditional nodes
export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  nextPort?: string;        // For conditional execution (if/else)
  nextPorts?: string[];     // For multi-branch logic (switch case)
  variables?: Record<string, unknown>; // For setting variables
  conditionalOutputs?: Record<string, unknown>; // Multiple conditional outputs
  error?: string;
  skipExecution?: boolean;  // For short-circuit evaluation
}

// Enhanced execution context for visual programming
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
  branchingNodes: Set<string>; // Nodes that create conditional branches
  
  // Loop execution tracking (future-ready)
  loopStates: Map<string, {
    currentIteration: number;
    maxIterations: number;
    loopVariable?: string;
    loopData?: unknown[];
  }>;
  
  // Function call tracking (future-ready)
  functionStack: Array<{
    nodeId: string;
    returnAddress: string;
    localVariables: Record<string, unknown>;
  }>;
  
  // Scene building - properly typed for current behavior
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

  // Enhanced debugging and execution tracking
  debugMode?: boolean;
  executionLog?: Array<{
    nodeId: string;
    timestamp: number;
    action: 'execute' | 'skip' | 'branch' | 'loop' | 'function_call';
    data?: unknown;
    conditionalPath?: string;
    variables?: Record<string, unknown>;
  }>;
  
  // Performance and optimization tracking
  executionMetrics?: {
    totalNodes: number;
    executedNodes: number;
    skippedNodes: number;
    branchingCount: number;
    executionStartTime: number;
  };
}

export function createExecutionContext(): ExecutionContext {
  return {
    nodeOutputs: new Map(),
    variables: new Map(),
    executedNodes: new Set(),
    currentTime: 0,
    conditionalPaths: new Map(),
    executionStack: [],
    branchingNodes: new Set(),
    loopStates: new Map(),
    functionStack: [],
    sceneObjects: [],
    sceneAnimations: [],
    debugMode: false,
    executionLog: [],
    executionMetrics: {
      totalNodes: 0,
      executedNodes: 0,
      skippedNodes: 0,
      branchingCount: 0,
      executionStartTime: Date.now(),
    }
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

  // Debug logging
  if (context.debugMode && context.executionLog) {
    context.executionLog.push({
      nodeId,
      timestamp: Date.now(),
      action: 'execute',
      data,
      variables: Object.fromEntries(context.variables)
    });
  }
  
  // Update execution metrics
  if (context.executionMetrics) {
    context.executionMetrics.executedNodes++;
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

// Variable management for logic nodes
export function setVariable(
  context: ExecutionContext,
  name: string,
  value: unknown,
  scope: 'global' | 'local' = 'global'
): void {
  if (scope === 'local' && context.functionStack.length > 0) {
    // Set in current function's local scope
    const currentFunction = context.functionStack[context.functionStack.length - 1]!;
    currentFunction.localVariables[name] = value;
  } else {
    // Set in global scope
    context.variables.set(name, value);
  }

  if (context.debugMode && context.executionLog) {
    context.executionLog.push({
      nodeId: 'system',
      timestamp: Date.now(),
      action: 'execute',
      data: { variableSet: name, value, scope },
      variables: Object.fromEntries(context.variables)
    });
  }
}

export function getVariable(
  context: ExecutionContext,
  name: string
): unknown {
  // Check local scope first (if in function)
  if (context.functionStack.length > 0) {
    const currentFunction = context.functionStack[context.functionStack.length - 1]!;
    if (name in currentFunction.localVariables) {
      return currentFunction.localVariables[name];
    }
  }
  
  // Fall back to global scope
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

// Conditional execution support (future-ready)
export function setConditionalPath(
  context: ExecutionContext,
  nodeId: string,
  path: 'true' | 'false' | 'default'
): void {
  context.conditionalPaths.set(nodeId, path);
  context.branchingNodes.add(nodeId);
  
  if (context.executionMetrics) {
    context.executionMetrics.branchingCount++;
  }

  if (context.debugMode && context.executionLog) {
    context.executionLog.push({
      nodeId,
      timestamp: Date.now(),
      action: 'branch',
      conditionalPath: path,
      variables: Object.fromEntries(context.variables)
    });
  }
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

// Loop execution support (future-ready)
export function initializeLoop(
  context: ExecutionContext,
  nodeId: string,
  maxIterations: number,
  loopVariable?: string,
  loopData?: unknown[]
): void {
  context.loopStates.set(nodeId, {
    currentIteration: 0,
    maxIterations,
    loopVariable,
    loopData
  });

  if (context.debugMode && context.executionLog) {
    context.executionLog.push({
      nodeId,
      timestamp: Date.now(),
      action: 'loop',
      data: { maxIterations, loopVariable },
      variables: Object.fromEntries(context.variables)
    });
  }
}

export function incrementLoop(
  context: ExecutionContext,
  nodeId: string
): boolean {
  const loopState = context.loopStates.get(nodeId);
  if (!loopState) return false;
  
  loopState.currentIteration++;
  
  // Update loop variable if present
  if (loopState.loopVariable && loopState.loopData) {
    const currentValue = loopState.loopData[loopState.currentIteration - 1];
    setVariable(context, loopState.loopVariable, currentValue);
  }
  
  return loopState.currentIteration < loopState.maxIterations;
}

export function isLoopComplete(
  context: ExecutionContext,
  nodeId: string
): boolean {
  const loopState = context.loopStates.get(nodeId);
  if (!loopState) return true;
  
  return loopState.currentIteration >= loopState.maxIterations;
}

// Function call support (future-ready)
export function pushFunctionCall(
  context: ExecutionContext,
  nodeId: string,
  returnAddress: string,
  parameters: Record<string, unknown> = {}
): void {
  context.functionStack.push({
    nodeId,
    returnAddress,
    localVariables: { ...parameters }
  });

  if (context.debugMode && context.executionLog) {
    context.executionLog.push({
      nodeId,
      timestamp: Date.now(),
      action: 'function_call',
      data: { returnAddress, parameters },
      variables: Object.fromEntries(context.variables)
    });
  }
}

export function popFunctionCall(
  context: ExecutionContext
): { nodeId: string; returnAddress: string; localVariables: Record<string, unknown> } | undefined {
  return context.functionStack.pop();
}

// Debug utilities
export function enableDebugMode(context: ExecutionContext): void {
  context.debugMode = true;
  if (!context.executionLog) {
    context.executionLog = [];
  }
  if (!context.executionMetrics) {
    context.executionMetrics = {
      totalNodes: 0,
      executedNodes: 0,
      skippedNodes: 0,
      branchingCount: 0,
      executionStartTime: Date.now(),
    };
  }
}

export function getExecutionLog(context: ExecutionContext): typeof context.executionLog {
  return context.executionLog ?? [];
}

export function getExecutionMetrics(context: ExecutionContext) {
  if (!context.executionMetrics) return null;
  
  const totalExecutionTime = Date.now() - context.executionMetrics.executionStartTime;
  
  return {
    ...context.executionMetrics,
    totalExecutionTime,
    executionEfficiency: context.executionMetrics.totalNodes > 0 
      ? (context.executionMetrics.executedNodes / context.executionMetrics.totalNodes) * 100 
      : 0
  };
}

// Type validation for logic nodes (future-ready)
export function validateExecutionValue(
  value: unknown,
  expectedType: ExecutionDataType
): boolean {
  switch (expectedType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
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
    case 'any':
      return true; // Any type is valid
    default:
      return true; // Unknown types pass through for compatibility
  }
}

// Convert execution value to specific type (future-ready)
export function coerceExecutionValue(
  value: unknown,
  targetType: ExecutionDataType
): unknown {
  switch (targetType) {
    case 'boolean':
      return Boolean(value);
    case 'number':
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return Number(value);
    case 'string':
      return String(value);
    case 'array':
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
}

// Utility to check if execution should continue based on conditions (future-ready)
export function shouldContinueExecution(
  context: ExecutionContext,
  nodeId: string,
  condition?: unknown
): boolean {
  // Check if node was already executed and shouldn't be re-executed
  if (isNodeExecuted(context, nodeId)) {
    return false;
  }
  
  // Check conditional execution
  if (condition !== undefined) {
    const conditionalResult = Boolean(condition);
    setConditionalPath(context, nodeId, conditionalResult ? 'true' : 'false');
    return conditionalResult;
  }
  
  return true;
}