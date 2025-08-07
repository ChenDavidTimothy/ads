// src/server/animation-processing/execution-engine.ts - Registry-driven execution engine
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import type { ExecutionContext } from "./execution-context";
import { 
  createExecutionContext, 
  setNodeOutput, 
  getConnectedInputs,
  markNodeExecuted,
  isNodeExecuted 
} from "./execution-context";
import { getNodeDefinition, getNodesByCategory, getNodeExecutionConfig } from "@/shared/registry/registry-utils";

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
}

export interface NodeExecutor {
  canHandle(nodeType: string): boolean;
  execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void>;
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
    const data = node.data as Record<string, unknown>;
    const baseObject = {
      id: node.data.identifier.id,
      type: node.type as "triangle" | "circle" | "rectangle",
      initialPosition: data.position as { x: number; y: number },
      initialRotation: 0,
      initialScale: { x: 1, y: 1 },
      initialOpacity: 1,
    };

    switch (node.type) {
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
        throw new Error(`Unknown geometry type: ${node.type}`);
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
    const data = node.data as Record<string, unknown>;
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    const timedObjects = [];
    
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
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', timedObjects);
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
    const data = node.data as Record<string, unknown>;
    const selectedObjectIds = (data.selectedObjectIds as string[]) || [];
    
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    if (inputs.length === 0) {
      setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', []);
      return;
    }
    
    const filteredResults = [];
    
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
    
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', filteredResults);
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
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    const allAnimations: SceneAnimationTrack[] = [];
    const passThoughObjects: unknown[] = [];
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const timedObject of inputData) {
        const objectStartTime = timedObject.appearanceTime || 0;
        const animations = this.convertTracksToSceneAnimations(
          (data.tracks as AnimationTrack[]) || [],
          timedObject.id,
          objectStartTime
        );
        allAnimations.push(...animations);
        passThoughObjects.push(timedObject);
      }
    }

    context.sceneAnimations.push(...allAnimations);
    const maxDuration = allAnimations.length > 0 ? 
      Math.max(...allAnimations.map(a => a.startTime + a.duration), context.currentTime) : 
      context.currentTime;
    context.currentTime = maxDuration;

    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', passThoughObjects);
  }

  private convertTracksToSceneAnimations(tracks: AnimationTrack[], objectId: string, objectStartTime: number): SceneAnimationTrack[] {
    return tracks.map((track): SceneAnimationTrack => {
      switch (track.type) {
        case 'move':
          return {
            objectId,
            type: 'move',
            startTime: objectStartTime + track.startTime,
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
            startTime: objectStartTime + track.startTime,
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
            startTime: objectStartTime + track.startTime,
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
            startTime: objectStartTime + track.startTime,
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
            startTime: objectStartTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
              property: track.properties.property,
            }
          };
        default:
          throw new Error(`Unknown track type: ${track.type}`);
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
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const item of inputData) {
        if (typeof item === 'object' && item !== null && 'id' in item && 'appearanceTime' in item) {
          context.sceneObjects.push(item);
        }
      }
    }
    
    if (context.sceneObjects.length === 0) {
      throw new Error(
        `Scene ${node.data.identifier.displayName} has no reachable objects. ` +
        `Connect object flows: Geometry → Insert → Animation → Scene`
      );
    }
  }
}

export class ExecutionEngine {
  private executors: NodeExecutor[] = [
    new GeometryNodeExecutor(),
    new TimingNodeExecutor(),
    new LogicNodeExecutor(),
    new AnimationNodeExecutor(),
    new SceneNodeExecutor()
  ];

  async executeFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): Promise<ExecutionContext> {
    this.validateScene(nodes);
    this.validateConnections(nodes, edges);
    this.validateProperFlow(nodes, edges);
    this.validateNoDuplicateObjectIds(nodes, edges);
    
    const context = createExecutionContext();
    
    const sceneNode = nodes.find(n => n.type === 'scene');
    if (!sceneNode) {
      throw new Error("Scene node is required");
    }
    
    const executionOrder = this.getTopologicalOrder(nodes, edges);
    
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
        throw new Error(
          `Node ${targetNode.data.identifier.displayName} receives duplicate object IDs: ${duplicates.join(', ')}. ` +
          `Each node can only receive each object once. Use Merge node to explicitly handle duplicate objects.`
        );
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
          throw new Error(
            `Geometry node ${geoNode.data.identifier.displayName} must connect to an Insert node ` +
            `(directly or through Filter nodes) to appear in the scene. Insert nodes control when objects appear in the timeline.`
          );
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
      throw new Error("Circular dependency detected in node graph");
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
          throw new Error(
            `Object ${sourceNode.data.identifier.displayName} cannot connect to multiple Insert nodes. ` +
            `Already connected to ${existingInsert}, attempted connection to ${targetNode.data.identifier.id}.`
          );
        }
        objectToInsertMap.set(sourceNode.data.identifier.id, targetNode.data.identifier.id);
      }
    }
  }

  private validateScene(nodes: ReactFlowNode<NodeData>[]): void {
    const sceneNodes = nodes.filter(node => node.type === "scene");
    
    if (sceneNodes.length === 0) {
      throw new Error("Scene node is required");
    }
    
    if (sceneNodes.length > 1) {
      throw new Error("Only one scene node allowed per workspace");
    }
  }

  private getExecutor(nodeType: string): NodeExecutor | undefined {
    return this.executors.find(executor => executor.canHandle(nodeType));
  }

  addExecutor(executor: NodeExecutor): void {
    this.executors.push(executor);
  }
}