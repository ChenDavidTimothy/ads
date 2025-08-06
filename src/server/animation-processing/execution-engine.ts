// src/server/animation-processing/execution-engine.ts - CORRECTED: Proper flow architecture
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

// Geometry node executor - CORRECTED: Only creates object definitions
class GeometryNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return ['triangle', 'circle', 'rectangle'].includes(nodeType);
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext
  ): Promise<void> {
    // CRITICAL FIX: Only create object definition, DO NOT add to scene
    // Only Insert nodes should add objects to the scene
    const objectDefinition = this.buildObjectDefinition(node);
    
    // Output the object definition for Insert nodes to consume
    setNodeOutput(context, node.data.identifier.id, 'object', 'object', objectDefinition);
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

// Insert node executor - CORRECTED: This is the ONLY place objects are added to scene
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
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'object');
    
    if (inputs.length === 0) {
      throw new Error(`Insert node ${node.data.identifier.displayName} missing required object input(s). Objects must be connected to Insert nodes to appear in the scene.`);
    }

    const timedObjects = [];
    
    for (const input of inputs) {
      // CRITICAL FIX: Insert node is the ONLY place where objects are added to the scene
      const sceneObject = {
        ...input.data,
        appearanceTime: data.appearanceTime as number
      };

      // Add object to scene - THIS IS THE ONLY PLACE THIS SHOULD HAPPEN
      context.sceneObjects.push(sceneObject);
      timedObjects.push(sceneObject);
    }

    context.currentTime = Math.max(context.currentTime, data.appearanceTime as number);
    setNodeOutput(context, node.data.identifier.id, 'timed_object', 'timed_object', timedObjects);
  }
}

// Animation node executor - handles multiple inputs
class AnimationNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'animation';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as Record<string, unknown>;
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'timed_object');
    
    if (inputs.length === 0) {
      throw new Error(`Animation node ${node.data.identifier.displayName} missing required timed object input(s). Connect Insert nodes to Animation nodes.`);
    }

    const allAnimations: SceneAnimationTrack[] = [];
    
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
      }
    }

    context.sceneAnimations.push(...allAnimations);
    const maxDuration = Math.max(...allAnimations.map(a => a.startTime + a.duration), context.currentTime);
    context.currentTime = maxDuration;

    setNodeOutput(context, node.data.identifier.id, 'animation', 'animation', allAnimations);
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

// Scene node executor - validates the complete flow
class SceneNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'scene';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<void> {
    // Scene node should receive animation inputs
    const animationInputs = getConnectedInputs(context, connections, node.data.identifier.id, 'animation');
    
    // Validate that scene has objects (they should come through proper flow)
    if (context.sceneObjects.length === 0) {
      throw new Error(
        `Scene ${node.data.identifier.displayName} has no objects. ` +
        `Objects must flow through: Geometry → Insert → Animation → Scene`
      );
    }
    
    // Validate that we have at least one animation input if we have objects
    if (animationInputs.length === 0 && context.sceneObjects.length > 0) {
      throw new Error(
        `Scene ${node.data.identifier.displayName} has objects but no animation input. ` +
        `Connect Animation nodes to Scene for proper flow.`
      );
    }
    
    setNodeOutput(context, node.data.identifier.id, 'scene', 'scene', node.data);
  }
}

export class ExecutionEngine {
  private executors: NodeExecutor[] = [
    new GeometryNodeExecutor(),
    new InsertNodeExecutor(),
    new AnimationNodeExecutor(),
    new SceneNodeExecutor()
  ];

  async executeFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): Promise<ExecutionContext> {
    this.validateScene(nodes);
    this.validateConnections(nodes, edges);
    this.validateProperFlow(nodes, edges);
    
    const context = createExecutionContext();
    
    // Topological execution order
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

  // NEW: Validate that the flow architecture is respected
  private validateProperFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const geometryNodes = nodes.filter(n => ['triangle', 'circle', 'rectangle'].includes(n.type!));
    const insertNodes = nodes.filter(n => n.type === 'insert');
    const sceneNodes = nodes.filter(n => n.type === 'scene');
    
    // Check that all geometry nodes that should appear in scene are connected to insert nodes
    for (const geoNode of geometryNodes) {
      const hasInsertConnection = edges.some(edge => 
        edge.source === geoNode.data.identifier.id && 
        insertNodes.some(insert => insert.data.identifier.id === edge.target)
      );
      
      // Check if this geometry node is ultimately connected to scene
      const isConnectedToScene = this.isNodeConnectedToScene(geoNode.data.identifier.id, edges, nodes);
      
      if (isConnectedToScene && !hasInsertConnection) {
        throw new Error(
          `Geometry node ${geoNode.data.identifier.displayName} must connect to an Insert node ` +
          `to appear in the scene. Insert nodes control when objects appear in the timeline.`
        );
      }
    }
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