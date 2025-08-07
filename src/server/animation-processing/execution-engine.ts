// src/server/animation-processing/execution-engine.ts - Scene-centric pull-based execution
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import type { ExecutionContext } from "./execution-context";
import { 
  createExecutionContext, 
  setNodeOutput, 
  getConnectedInputs,
  markNodeExecuted,
  isNodeExecuted 
} from "./execution-context";

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

// Geometry node executor - Creates object definitions only
class GeometryNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return ['triangle', 'circle', 'rectangle'].includes(nodeType);
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext
  ): Promise<void> {
    const objectDefinition = this.buildObjectDefinition(node);
    
    // Output object definition only - don't add to scene
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

// Insert node executor - Only marks timing, doesn't add to scene
class InsertNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'insert';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as Record<string, unknown>;
    
    // Get inputs - if none, just pass empty array (no error)
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    const timedObjects = [];
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const objectDef of inputData) {
        // Insert node ONLY adds timing information - Scene decides what gets added to scene
        const timedObject = {
          ...objectDef,
          appearanceTime: data.appearanceTime as number
        };

        timedObjects.push(timedObject);
      }
    }

    context.currentTime = Math.max(context.currentTime, data.appearanceTime as number);
    
    // Output timed objects - Scene will decide if they get rendered
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', timedObjects);
  }
}

// Filter node executor - Unchanged, already follows pull model
class FilterNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'filter';
  }

  async execute(
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

// Animation node executor - No input requirements, processes if inputs exist
class AnimationNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'animation';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    
    // Get inputs - if none, just output empty array (no error)
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
        
        // Pass through the timed object so Scene can receive it
        passThoughObjects.push(timedObject);
      }
    }

    // Add animations to context for Scene node to find
    context.sceneAnimations.push(...allAnimations);
    const maxDuration = allAnimations.length > 0 ? 
      Math.max(...allAnimations.map(a => a.startTime + a.duration), context.currentTime) : 
      context.currentTime;
    context.currentTime = maxDuration;

    // Output the timed objects (not animations) so Scene can receive them
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

// Scene node executor - Uses direct inputs like every other node
class SceneNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'scene';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    // Scene node uses direct inputs - respects all upstream filtering/processing
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    // Process all inputs that actually reached Scene node through the flow
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const item of inputData) {
        // Only add objects that have appearance time (processed by Insert nodes)
        if (typeof item === 'object' && item !== null && 'id' in item && 'appearanceTime' in item) {
          context.sceneObjects.push(item);
        }
      }
    }
    
    // Validate that we found at least some objects
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
    new InsertNodeExecutor(),
    new FilterNodeExecutor(),
    new AnimationNodeExecutor(),
    new SceneNodeExecutor()
  ];

  async executeFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): Promise<ExecutionContext> {
    this.validateScene(nodes);
    this.validateConnections(nodes, edges);
    this.validateProperFlow(nodes, edges);
    this.validateNoDuplicateObjectIds(nodes, edges);
    
    const context = createExecutionContext();
    
    // Scene-centric execution: Start from Scene node and work backwards
    const sceneNode = nodes.find(n => n.type === 'scene');
    if (!sceneNode) {
      throw new Error("Scene node is required");
    }
    
    // Execute all nodes in topological order (needed to populate outputs)
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

  // Validate that no node receives duplicate object IDs (except future Merge node)
  private validateNoDuplicateObjectIds(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    for (const targetNode of nodes) {
      // Skip geometry nodes (no inputs) and future merge node
      if (['triangle', 'circle', 'rectangle'].includes(targetNode.type!) || targetNode.type === 'merge') {
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

  // Get all object IDs that would reach a specific target node
  private getIncomingObjectIds(targetNodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): string[] {
    const geometryNodes: ReactFlowNode<NodeData>[] = [];
    const visited = new Set<string>();
    
    const traceUpstream = (currentNodeId: string): void => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (!currentNode) return;
      
      // If this is a geometry node, collect it
      if (['triangle', 'circle', 'rectangle'].includes(currentNode.type!)) {
        geometryNodes.push(currentNode);
        return;
      }
      
      // For other nodes, trace upstream to find geometry sources
      const incomingEdges = edges.filter(edge => edge.target === currentNodeId);
      for (const edge of incomingEdges) {
        traceUpstream(edge.source);
      }
    };
    
    // Start tracing from target node
    traceUpstream(targetNodeId);
    
    // Return object IDs (geometry nodes use their own ID as object ID)
    return geometryNodes.map(node => node.data.identifier.id);
  }

  // Validate that the flow architecture is respected
  private validateProperFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const geometryNodes = nodes.filter(n => ['triangle', 'circle', 'rectangle'].includes(n.type!));
    
    // Check that all geometry nodes that should appear in scene can reach insert nodes
    for (const geoNode of geometryNodes) {
      const isConnectedToScene = this.isNodeConnectedToScene(geoNode.data.identifier.id, edges, nodes);
      
      if (isConnectedToScene) {
        // Check if this geometry node can reach an insert node (directly or through filter nodes)
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

  // Helper to check if a node can reach a specific node type (allows transparent intermediates like filters)
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

  // Helper to check if a node is ultimately connected to scene
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
    
    // Initialize using identifier.id
    for (const node of nodes) {
      inDegree.set(node.data.identifier.id, 0);
      adjList.set(node.data.identifier.id, []);
    }
    
    // Build adjacency list and in-degree count
    for (const edge of edges) {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    
    // Kahn's algorithm for topological sorting
    const queue: ReactFlowNode<NodeData>[] = [];
    const result: ReactFlowNode<NodeData>[] = [];
    
    // Start with nodes that have no dependencies
    for (const node of nodes) {
      if (inDegree.get(node.data.identifier.id) === 0) {
        queue.push(node);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      // Reduce in-degree for neighbors
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
    
    // Check for cycles
    if (result.length !== nodes.length) {
      throw new Error("Circular dependency detected in node graph");
    }
    
    return result;
  }

  private validateConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    // Track object -> insert mappings
    const objectToInsertMap = new Map<string, string>();
    
    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.data.identifier.id === edge.source);
      const targetNode = nodes.find(n => n.data.identifier.id === edge.target);
      
      if (!sourceNode || !targetNode) continue;
      
      // Check for object -> multiple insert violations
      if (['triangle', 'circle', 'rectangle'].includes(sourceNode.type!) && 
          targetNode.type === 'insert') {
        
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