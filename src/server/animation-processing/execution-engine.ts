// src/server/animation-processing/execution-engine.ts - Registry-driven execution engine
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import type { ExecutionContext, ExecutionValue } from "./execution-context";
import { 
  createExecutionContext, 
  setNodeOutput, 
  getConnectedInputs,
  markNodeExecuted,
  isNodeExecuted 
} from "./execution-context";
import { getNodeDefinition, getNodesByCategory, getNodeExecutionConfig } from "@/shared/registry/registry-utils";
import {
  CircularDependencyError,
  DuplicateObjectIdsError,
  MissingInsertConnectionError,
  MultipleInsertConnectionsError,
  SceneRequiredError,
  TooManyScenesError,
  UnknownNodeTypeError,
} from "@/shared/errors/domain";
import type { PortType } from "@/shared/types";

// ReactFlow-compatible types for server
export interface ReactFlowNode<T = unknown> {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: T;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  kind?: 'data' | 'control';
}

export interface NodeExecutor {
  canHandle(nodeType: string): boolean;
  execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void>;
}

// Minimal executor registry for scalability
class ExecutorRegistry {
  private executors: NodeExecutor[] = [];
  register(executor: NodeExecutor): void { this.executors.push(executor); }
  find(nodeType: string): NodeExecutor | undefined { return this.executors.find(e => e.canHandle(nodeType)); }
  list(): NodeExecutor[] { return [...this.executors]; }
}

function extractObjectIdsFromInputs(inputs: Array<{ data: unknown }>): string[] {
  const ids: string[] = [];
  for (const input of inputs) {
    const items = Array.isArray(input.data) ? input.data : [input.data];
    for (const item of items) {
      if (typeof item === 'object' && item !== null && 'id' in item) {
        const id = (item as { id: unknown }).id;
        if (typeof id === 'string') {
          ids.push(id);
        }
      }
    }
  }
  return ids;
}

function assertNoDuplicateObjectIds(nodeType: string | undefined, nodeName: string, nodeId: string, inputs: Array<{ data: unknown }>): void {
  if (nodeType === 'merge') return;
  const ids = extractObjectIdsFromInputs(inputs);
  if (ids.length === 0) return;
  const seen = new Map<string, number>();
  for (const id of ids) {
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const duplicates = Array.from(seen.entries()).filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicates.length > 0) {
    throw new DuplicateObjectIdsError(nodeName, nodeId, duplicates);
  }
}

// Per-object time cursor utilities
type PerObjectCursorMap = Record<string, number>;

function isPerObjectCursorMap(value: unknown): value is PerObjectCursorMap {
  if (typeof value !== 'object' || value === null) return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== 'number') return false;
  }
  return true;
}

function mergeCursorMaps(cursorMaps: PerObjectCursorMap[]): PerObjectCursorMap {
  const merged: PerObjectCursorMap = {};
  for (const map of cursorMaps) {
    for (const [objectId, time] of Object.entries(map)) {
      if (!(objectId in merged)) {
        merged[objectId] = time;
      } else {
        merged[objectId] = Math.max(merged[objectId]!, time);
      }
    }
  }
  return merged;
}

function extractCursorsFromInputs(inputs: ExecutionValue[]): PerObjectCursorMap {
  const maps: PerObjectCursorMap[] = [];
  for (const input of inputs) {
    const maybeMap = (input.metadata as { perObjectTimeCursor?: unknown } | undefined)?.perObjectTimeCursor;
    if (isPerObjectCursorMap(maybeMap)) {
      maps.push(maybeMap);
    }
  }
  return mergeCursorMaps(maps);
}

function pickCursorsForIds(cursorMap: PerObjectCursorMap, ids: string[]): PerObjectCursorMap {
  const picked: PerObjectCursorMap = {};
  for (const id of ids) {
    if (id in cursorMap) picked[id] = cursorMap[id]!;
  }
  return picked;
}

// Registry-driven Geometry node executor
class GeometryNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const executionConfig = getNodeExecutionConfig(nodeType);
    return executionConfig?.executor === 'geometry';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext
  ): Promise<void> {
    const objectDefinition = this.buildObjectDefinition(node);
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', [objectDefinition]);
  }

  private buildObjectDefinition(node: ReactFlowNode<NodeData>) {
    const data = node.data as unknown as Record<string, unknown>;
    const baseObject = {
      id: node.data.identifier.id,
      type: node.type as "triangle" | "circle" | "rectangle",
      initialPosition: data.position as { x: number; y: number },
      initialRotation: 0,
      initialScale: { x: 1, y: 1 },
      initialOpacity: 1,
    };

    switch (node.type as 'filter' | string) {
      case "triangle":
        return {
          ...baseObject,
          properties: {
            size: data.size as number,
            color: data.color as string,
            strokeColor: data.strokeColor as string,
            strokeWidth: data.strokeWidth as number,
          },
        };
      case "circle":
        return {
          ...baseObject,
          properties: {
            radius: data.radius as number,
            color: data.color as string,
            strokeColor: data.strokeColor as string,
            strokeWidth: data.strokeWidth as number,
          },
        };
      case "rectangle":
        return {
          ...baseObject,
          properties: {
            width: data.width as number,
            height: data.height as number,
            color: data.color as string,
            strokeColor: data.strokeColor as string,
            strokeWidth: data.strokeWidth as number,
          },
        };
      default:
        throw new UnknownNodeTypeError(String(node.type));
    }
  }
}

// Registry-driven Timing node executor (Insert nodes)
class TimingNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const executionConfig = getNodeExecutionConfig(nodeType);
    return executionConfig?.executor === 'timing';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );
    assertNoDuplicateObjectIds(node.type, node.data.identifier.displayName, node.data.identifier.id, inputs);
    
    const timedObjects: unknown[] = [];
    const upstreamCursorMap = extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const objectDef of inputData) {
        const timedObject = {
          ...objectDef,
          appearanceTime: data.appearanceTime as number
        };

        timedObjects.push(timedObject);
      }
    }

    context.currentTime = Math.max(context.currentTime, data.appearanceTime as number);
    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      timedObjects,
      { perObjectTimeCursor: upstreamCursorMap }
    );
  }
}

// Registry-driven Logic node executor (Filter nodes, future-ready for if/else, etc.)
class LogicNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const executionConfig = getNodeExecutionConfig(nodeType);
    return executionConfig?.executor === 'logic';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    // Route to specific logic node handler based on type
    switch (node.type) {
      case 'filter':
        await this.executeFilter(node, context, connections);
        break;
      // Future logic nodes will be handled here
      // case 'if_else':
      //   await this.executeIfElse(node, context, connections);
      //   break;
      // case 'comparison':
      //   await this.executeComparison(node, context, connections);
      //   break;
      default:
        throw new Error(`Unknown logic node type: ${node.type}`);
    }
  }

  private async executeFilter(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const selectedObjectIds = (data.selectedObjectIds as string[]) || [];
    
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );
    assertNoDuplicateObjectIds(node.type, node.data.identifier.displayName, node.data.identifier.id, inputs);
    
    if (inputs.length === 0) {
      setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', [], { perObjectTimeCursor: {} });
      return;
    }
    
    const filteredResults: unknown[] = [];
    const upstreamCursorMap = extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const item of inputData) {
        if (this.hasFilterableObjects(item)) {
          const filtered = this.filterItem(item, selectedObjectIds);
          if (filtered) {
            filteredResults.push(filtered);
          }
        } else {
          filteredResults.push(item);
        }
      }
    }
    
    const filteredIds = extractObjectIdsFromInputs([{ data: filteredResults }]);
    const propagatedCursors = pickCursorsForIds(upstreamCursorMap, filteredIds);
    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      filteredResults,
      { perObjectTimeCursor: propagatedCursors }
    );
  }

  private hasFilterableObjects(item: unknown): boolean {
    return typeof item === 'object' && item !== null && 'id' in item;
  }

  private filterItem(item: unknown, selectedObjectIds: string[]): unknown | null {
    if (typeof item === 'object' && item !== null && 'id' in item) {
      const objectId = (item as { id: string }).id;
      return selectedObjectIds.includes(objectId) ? item : null;
    }
    
    return item;
  }
}

// Registry-driven Animation node executor
class AnimationNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const executionConfig = getNodeExecutionConfig(nodeType);
    return executionConfig?.executor === 'animation';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );
    assertNoDuplicateObjectIds(node.type, node.data.identifier.displayName, node.data.identifier.id, inputs);
    
    const allAnimations: SceneAnimationTrack[] = [];
    const passThoughObjects: unknown[] = [];
    const upstreamCursorMap = extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);
    const outputCursorMap: PerObjectCursorMap = { ...upstreamCursorMap };
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const timedObject of inputData) {
        const objectId = (timedObject as { id?: unknown }).id as string | undefined;
        const appearanceTime = (timedObject as { appearanceTime?: unknown }).appearanceTime as number | undefined;
        const baseline = (objectId && upstreamCursorMap[objectId] !== undefined)
          ? upstreamCursorMap[objectId]!
          : (appearanceTime ?? 0);
        const animations = this.convertTracksToSceneAnimations(
          (data.tracks as AnimationTrack[]) || [],
          objectId ?? '',
          baseline
        );
        allAnimations.push(...animations);
        passThoughObjects.push(timedObject);

        if (objectId) {
          const localEnd = animations.length > 0
            ? Math.max(...animations.map(a => a.startTime + a.duration))
            : baseline; // no animations, cursor remains baseline
          // If animations exist, localEnd already includes baseline in startTime
          const newCursor = animations.length > 0 ? localEnd : baseline;
          outputCursorMap[objectId] = Math.max(outputCursorMap[objectId] ?? 0, newCursor);
        }
      }
    }

    context.sceneAnimations.push(...allAnimations);
    const maxDuration = allAnimations.length > 0 ? 
      Math.max(...allAnimations.map(a => a.startTime + a.duration), context.currentTime) : 
      context.currentTime;
    context.currentTime = maxDuration;

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThoughObjects,
      { perObjectTimeCursor: outputCursorMap }
    );
  }

  private convertTracksToSceneAnimations(tracks: AnimationTrack[], objectId: string, baselineTime: number): SceneAnimationTrack[] {
    return tracks.map((track): SceneAnimationTrack => {
      switch (track.type) {
        case 'move':
          return {
            objectId,
            type: 'move',
            startTime: baselineTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
            }
          };
        case 'rotate':
          return {
            objectId,
            type: 'rotate',
            startTime: baselineTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: 0,
              to: 0,
              rotations: track.properties.rotations,
            }
          };
        case 'scale':
          return {
            objectId,
            type: 'scale',
            startTime: baselineTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
            }
          };
        case 'fade':
          return {
            objectId,
            type: 'fade',
            startTime: baselineTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
            }
          };
        case 'color':
          return {
            objectId,
            type: 'color',
            startTime: baselineTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
              property: track.properties.property,
            }
          };
        default: {
          const _exhaustiveCheck: never = track as never;
          throw new Error(`Unknown track type: ${String((_exhaustiveCheck as unknown as { type?: string }).type ?? 'unknown')}`);
        }
      }
    });
  }
}

// Registry-driven Scene node executor
class SceneNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const executionConfig = getNodeExecutionConfig(nodeType);
    return executionConfig?.executor === 'scene';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );
    assertNoDuplicateObjectIds(node.type, node.data.identifier.displayName, node.data.identifier.id, inputs);
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const item of inputData) {
        if (typeof item === 'object' && item !== null && 'id' in item && 'appearanceTime' in item) {
          context.sceneObjects.push(item);
        }
      }
    }
    
    if (context.sceneObjects.length === 0) {
      throw new MissingInsertConnectionError(node.data.identifier.displayName, node.data.identifier.id);
    }
  }
}

export class ExecutionEngine {
  private registry: ExecutorRegistry = new ExecutorRegistry();

  constructor() {
    // Register built-in executors
    this.registry.register(new GeometryNodeExecutor());
    this.registry.register(new TimingNodeExecutor());
    this.registry.register(new LogicNodeExecutor());
    this.registry.register(new AnimationNodeExecutor());
    this.registry.register(new SceneNodeExecutor());
  }

  async executeFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): Promise<ExecutionContext> {
    this.validateScene(nodes);
    this.validateConnections(nodes, edges);
    this.validateProperFlow(nodes, edges);
    this.validateNoDuplicateObjectIds(nodes, edges);
    
    const context = createExecutionContext();
    
    const sceneNode = nodes.find(n => n.type === 'scene');
    if (!sceneNode) {
      throw new SceneRequiredError();
    }
    
    // Build execution order based on data edges (control edges ignored for simple DAG scheduling)
    const executionOrder = this.getTopologicalOrder(nodes, edges.filter(e => (e.kind ?? 'data') === 'data'));
    
    for (const node of executionOrder) {
      if (!isNodeExecuted(context, node.data.identifier.id)) {
        const executor = this.getExecutor(node.type!);
        if (executor) {
          await executor.execute(node, context, edges);
          markNodeExecuted(context, node.data.identifier.id);
        }
      }
    }
    
    return context;
  }

  // Registry-driven validation methods
  private validateNoDuplicateObjectIds(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    
    for (const targetNode of nodes) {
      if (geometryNodeTypes.includes(targetNode.type!) || targetNode.type === 'merge') {
        continue;
      }

      const incomingObjectIds = this.getIncomingObjectIds(targetNode.data.identifier.id, edges, nodes);
      const duplicates = incomingObjectIds.filter((id, index) => 
        incomingObjectIds.indexOf(id) !== index
      );
      
      if (duplicates.length > 0) {
        throw new DuplicateObjectIdsError(targetNode.data.identifier.displayName, targetNode.data.identifier.id, duplicates);
      }
    }
  }

  private getIncomingObjectIds(targetNodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): string[] {
    const geometryNodes: ReactFlowNode<NodeData>[] = [];
    const visited = new Set<string>();
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    
    const traceUpstream = (currentNodeId: string): void => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (!currentNode) return;
      
      if (geometryNodeTypes.includes(currentNode.type!)) {
        geometryNodes.push(currentNode);
        return;
      }
      
      const incomingEdges = edges.filter(edge => edge.target === currentNodeId);
      for (const edge of incomingEdges) {
        traceUpstream(edge.source);
      }
    };
    
    traceUpstream(targetNodeId);
    return geometryNodes.map(node => node.data.identifier.id);
  }

  private validateProperFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    const geometryNodes = nodes.filter(n => geometryNodeTypes.includes(n.type!));
    
    for (const geoNode of geometryNodes) {
      const isConnectedToScene = this.isNodeConnectedToScene(geoNode.data.identifier.id, edges, nodes);
      
      if (isConnectedToScene) {
        const canReachInsert = this.canReachNodeType(geoNode.data.identifier.id, 'insert', edges, nodes);
        
        if (!canReachInsert) {
          throw new MissingInsertConnectionError(geoNode.data.identifier.displayName, geoNode.data.identifier.id);
        }
      }
    }
  }

  private canReachNodeType(
    startNodeId: string, 
    targetNodeType: string, 
    edges: ReactFlowEdge[], 
    nodes: ReactFlowNode<NodeData>[]
  ): boolean {
    const visited = new Set<string>();
    
    const traverse = (currentNodeId: string): boolean => {
      if (visited.has(currentNodeId)) return false;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (currentNode?.type === targetNodeType) return true;
      
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      return outgoingEdges.some(edge => traverse(edge.target));
    };
    
    return traverse(startNodeId);
  }

  private isNodeConnectedToScene(nodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): boolean {
    const visited = new Set<string>();
    
    const traverse = (currentNodeId: string): boolean => {
      if (visited.has(currentNodeId)) return false;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (currentNode?.type === 'scene') return true;
      
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      return outgoingEdges.some(edge => traverse(edge.target));
    };
    
    return traverse(nodeId);
  }

  private getTopologicalOrder(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): ReactFlowNode<NodeData>[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    
    for (const node of nodes) {
      inDegree.set(node.data.identifier.id, 0);
      adjList.set(node.data.identifier.id, []);
    }
    
    for (const edge of edges) {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    
    const queue: ReactFlowNode<NodeData>[] = [];
    const result: ReactFlowNode<NodeData>[] = [];
    
    for (const node of nodes) {
      if (inDegree.get(node.data.identifier.id) === 0) {
        queue.push(node);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      for (const neighborId of adjList.get(current.data.identifier.id) ?? []) {
        const newInDegree = (inDegree.get(neighborId) ?? 1) - 1;
        inDegree.set(neighborId, newInDegree);
        
        if (newInDegree === 0) {
          const neighborNode = nodes.find(n => n.data.identifier.id === neighborId);
          if (neighborNode) {
            queue.push(neighborNode);
          }
        }
      }
    }
    
    if (result.length !== nodes.length) {
      throw new CircularDependencyError();
    }
    
    return result;
  }

  private validateConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const objectToInsertMap = new Map<string, string>();
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    
    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.data.identifier.id === edge.source);
      const targetNode = nodes.find(n => n.data.identifier.id === edge.target);
      
      if (!sourceNode || !targetNode) continue;
      
      if (geometryNodeTypes.includes(sourceNode.type!) && targetNode.type === 'insert') {
        const existingInsert = objectToInsertMap.get(sourceNode.data.identifier.id);
        if (existingInsert && existingInsert !== targetNode.data.identifier.id) {
          throw new MultipleInsertConnectionsError(
            sourceNode.data.identifier.displayName,
            sourceNode.data.identifier.id,
            targetNode.data.identifier.id,
            existingInsert,
          );
        }
        objectToInsertMap.set(sourceNode.data.identifier.id, targetNode.data.identifier.id);
      }
    }
  }

  private validateScene(nodes: ReactFlowNode<NodeData>[]): void {
    const sceneNodes = nodes.filter(node => node.type === "scene");
    
    if (sceneNodes.length === 0) {
      throw new SceneRequiredError();
    }
    
    if (sceneNodes.length > 1) {
      throw new TooManyScenesError();
    }
  }

  private getExecutor(nodeType: string): NodeExecutor | undefined {
    return this.registry.find(nodeType);
  }

  addExecutor(executor: NodeExecutor): void {
    this.registry.register(executor);
  }
}