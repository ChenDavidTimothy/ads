// src/lib/execution/execution-context.ts - River flow model with exclusive routing
import type { PortType, PathFilter } from "../types/ports";
import type { SceneAnimationTrack } from "@/animation/scene/types";
import type { StreamObject, ObjectStream } from "../types/nodes";

export interface ExecutionValue {
  type: PortType;
  data: ObjectStream;
  nodeId: string;
  portId: string;
}

// River flow state tracking
export interface RiverFlowState {
  // Track which objects are claimed by which paths
  objectPathClaims: Map<string, string>; // objectId -> edgeId
  
  // Track available objects at each node output
  nodeAvailableObjects: Map<string, Set<string>>; // nodeId.portId -> Set<objectId>
  
  // Path filter configurations
  pathFilters: Map<string, PathFilter>; // edgeId -> filter
  
  // Computed filtered streams for each path
  pathStreams: Map<string, ObjectStream>; // edgeId -> filtered stream
}

export interface ExecutionContext {
  nodeOutputs: Map<string, ExecutionValue>;
  variables: Map<string, unknown>;
  executedNodes: Set<string>;
  currentTime: number;
  
  // Scene building
  sceneObjects: Array<{
    id: string;
    objectName?: string;
    nodeName?: string;
    type: 'triangle' | 'circle' | 'rectangle';
    properties: Record<string, unknown>;
    initialPosition: { x: number; y: number };
    initialRotation?: number;
    initialScale?: { x: number; y: number };
    initialOpacity?: number;
    appearanceTime?: number;
  }>;
  sceneAnimations: SceneAnimationTrack[];
  
  // River flow state
  riverFlow: RiverFlowState;
}

export function createExecutionContext(): ExecutionContext {
  return {
    nodeOutputs: new Map(),
    variables: new Map(),
    executedNodes: new Set(),
    currentTime: 0,
    sceneObjects: [],
    sceneAnimations: [],
    riverFlow: {
      objectPathClaims: new Map(),
      nodeAvailableObjects: new Map(),
      pathFilters: new Map(),
      pathStreams: new Map()
    }
  };
}

export function setNodeOutput(
  context: ExecutionContext,
  nodeId: string,
  portId: string,
  type: PortType,
  stream: ObjectStream
): void {
  const key = `${nodeId}.${portId}`;
  context.nodeOutputs.set(key, {
    type,
    data: stream,
    nodeId,
    portId
  });
  
  // Track available objects at this output
  const objectIds = new Set(stream.objects.map(obj => obj.objectId));
  context.riverFlow.nodeAvailableObjects.set(key, objectIds);
}

export function getNodeOutput(
  context: ExecutionContext,
  nodeId: string,
  portId: string
): ExecutionValue | undefined {
  const key = `${nodeId}.${portId}`;
  return context.nodeOutputs.get(key);
}

// River flow path filtering with exclusive routing
export function getConnectedInput(
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
): ExecutionValue | undefined {
  const connection = connections.find(
    conn => conn.target === targetNodeId && conn.targetHandle === targetPortId
  );
  
  if (!connection) return undefined;
  
  const sourceOutput = getNodeOutput(context, connection.source, connection.sourceHandle);
  if (!sourceOutput) return undefined;
  
  // Check if we have a pre-computed filtered stream for this path
  const filteredStream = context.riverFlow.pathStreams.get(connection.id);
  if (filteredStream) {
    return {
      ...sourceOutput,
      data: filteredStream
    };
  }
  
  return sourceOutput;
}

export function getConnectedInputs(
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
    const input = getConnectedInput(context, [connection], targetNodeId, targetPortId);
    if (input) {
      inputs.push(input);
    }
  }
  
  return inputs;
}

// River flow management functions
export function setPathFilter(
  context: ExecutionContext,
  edgeId: string,
  filter: PathFilter
): void {
  const oldFilter = context.riverFlow.pathFilters.get(edgeId);
  context.riverFlow.pathFilters.set(edgeId, filter);
  
  // If filter changed, recompute all path flows
  if (!oldFilter || !pathFiltersEqual(oldFilter, filter)) {
    recomputeRiverFlow(context);
  }
}

export function getPathFilter(
  context: ExecutionContext,
  edgeId: string
): PathFilter | undefined {
  return context.riverFlow.pathFilters.get(edgeId);
}

// Get available objects for path selection (excludes already claimed objects)
export function getAvailableObjectsForPath(
  context: ExecutionContext,
  edgeId: string,
  sourceNodeId: string,
  sourcePortId: string,
  allEdges: Array<{ id: string; source: string; sourceHandle: string; target: string; targetHandle: string }>
): Array<{ id: string; name: string; claimed: boolean }> {
  const sourceKey = `${sourceNodeId}.${sourcePortId}`;
  const availableObjectIds = context.riverFlow.nodeAvailableObjects.get(sourceKey) || new Set();
  
  // Find parallel paths from same source
  const parallelPaths = allEdges.filter(edge => 
    edge.source === sourceNodeId && 
    edge.sourceHandle === sourcePortId && 
    edge.id !== edgeId
  );
  
  const result: Array<{ id: string; name: string; claimed: boolean }> = [];
  
  for (const objectId of availableObjectIds) {
    const claimedByEdge = context.riverFlow.objectPathClaims.get(objectId);
    const claimed = claimedByEdge !== undefined && claimedByEdge !== edgeId;
    
    // Get object name from source stream
    const sourceOutput = getNodeOutput(context, sourceNodeId, sourcePortId);
    const streamObject = sourceOutput?.data.objects.find(obj => obj.objectId === objectId);
    const name = streamObject?.objectName || streamObject?.nodeName || objectId;
    
    result.push({
      id: objectId,
      name,
      claimed
    });
  }
  
  return result;
}

// Recompute entire river flow based on current path filters
export function recomputeRiverFlow(context: ExecutionContext): void {
  // Clear current claims and streams
  context.riverFlow.objectPathClaims.clear();
  context.riverFlow.pathStreams.clear();
  
  // Process each path filter
  for (const [edgeId, filter] of context.riverFlow.pathFilters) {
    if (!filter.filterEnabled || filter.selectedObjectIds.length === 0) {
      continue;
    }
    
    // Claim objects for this path
    for (const objectId of filter.selectedObjectIds) {
      const existingClaim = context.riverFlow.objectPathClaims.get(objectId);
      if (!existingClaim) {
        context.riverFlow.objectPathClaims.set(objectId, edgeId);
      }
    }
  }
  
  // Compute filtered streams for each path
  for (const [edgeId, filter] of context.riverFlow.pathFilters) {
    const sourceOutput = findSourceOutputForEdge(context, edgeId);
    if (!sourceOutput) continue;
    
    let filteredObjects = sourceOutput.data.objects;
    
    if (filter.filterEnabled) {
      if (filter.selectedObjectIds.length > 0) {
        // Include only selected objects
        filteredObjects = sourceOutput.data.objects.filter(obj => 
          filter.selectedObjectIds.includes(obj.objectId)
        );
      } else {
        // Include only unclaimed objects
        filteredObjects = sourceOutput.data.objects.filter(obj => 
          !context.riverFlow.objectPathClaims.has(obj.objectId) ||
          context.riverFlow.objectPathClaims.get(obj.objectId) === edgeId
        );
      }
    }
    
    const filteredStream: ObjectStream = {
      ...sourceOutput.data,
      objects: filteredObjects
    };
    
    context.riverFlow.pathStreams.set(edgeId, filteredStream);
  }
}

// Helper functions
function pathFiltersEqual(a: PathFilter, b: PathFilter): boolean {
  if (a.filterEnabled !== b.filterEnabled) return false;
  if (a.selectedObjectIds.length !== b.selectedObjectIds.length) return false;
  return a.selectedObjectIds.every(id => b.selectedObjectIds.includes(id));
}

function findSourceOutputForEdge(context: ExecutionContext, edgeId: string): ExecutionValue | undefined {
  // This would need to be tracked when edges are processed
  // For now, return undefined - this will be called during execution
  return undefined;
}

export function createObjectStream(
  sourceNodeId: string,
  sourcePortId: string,
  objects: StreamObject[]
): ObjectStream {
  return {
    objects,
    sourceNodeId,
    sourcePortId
  };
}

// Legacy functions for compatibility
export function setVariable(context: ExecutionContext, name: string, value: unknown): void {
  context.variables.set(name, value);
}

export function getVariable(context: ExecutionContext, name: string): unknown {
  return context.variables.get(name);
}

export function markNodeExecuted(context: ExecutionContext, nodeId: string): void {
  context.executedNodes.add(nodeId);
}

export function isNodeExecuted(context: ExecutionContext, nodeId: string): boolean {
  return context.executedNodes.has(nodeId);
}