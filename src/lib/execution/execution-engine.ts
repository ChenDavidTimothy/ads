// src/lib/execution/execution-engine.ts
import type { Node, Edge } from "reactflow";
import type { ExecutionContext } from "./execution-context";
import { 
  createExecutionContext, 
  setNodeOutput, 
  getConnectedInputs,
  markNodeExecuted,
  isNodeExecuted 
} from "./execution-context";
import type { NodeData, AnimationTrack } from "../types/nodes";
import type { SceneAnimationTrack } from "@/animation/scene/types";

export interface NodeExecutor {
  canHandle(nodeType: string): boolean;
  execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void>;
}

// Geometry node executor
class GeometryNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return ['triangle', 'circle', 'rectangle'].includes(nodeType);
  }

  async execute(
    node: Node<NodeData>, 
    context: ExecutionContext
  ): Promise<void> {
    const sceneObject = this.buildSceneObject(node);
    context.sceneObjects.push(sceneObject);
    
    setNodeOutput(context, node.id, 'object', 'object', sceneObject);
  }

  private buildSceneObject(node: Node<NodeData>) {
    const data = node.data as Record<string, unknown>;
    const baseObject = {
      id: node.id,
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

// Insert node executor - handles multiple inputs
class InsertNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'insert';
  }

  async execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void> {
    const data = node.data as Record<string, unknown>;
    const inputs = getConnectedInputs(context, connections, node.id, 'object');
    
    if (inputs.length === 0) {
      throw new Error(`Insert node ${node.id} missing required object input(s)`);
    }

    const timedObjects = [];
    
    for (const input of inputs) {
      // Store appearance time on object - timeline will handle visibility
      const timedObject = {
        ...input.data,
        appearanceTime: data.appearanceTime as number
      };

      // Update object in scene
      const objectIndex = context.sceneObjects.findIndex(obj => obj.id === input.data.id);
      if (objectIndex !== -1) {
        context.sceneObjects[objectIndex] = timedObject;
      }

      timedObjects.push(timedObject);
    }

    context.currentTime = Math.max(context.currentTime, data.appearanceTime as number);
    setNodeOutput(context, node.id, 'timed_object', 'timed_object', timedObjects);
  }
}

// Animation node executor - handles multiple inputs
class AnimationNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'animation';
  }

  async execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void> {
    const data = node.data as Record<string, unknown>;
    const inputs = getConnectedInputs(context, connections, node.id, 'timed_object');
    
    if (inputs.length === 0) {
      throw new Error(`Animation node ${node.id} missing required timed object input(s)`);
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

    setNodeOutput(context, node.id, 'animation', 'animation', allAnimations);
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

// Scene node executor - now properly processes animation inputs
class SceneNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'scene';
  }

  async execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void> {
    // Scene node can optionally receive animation inputs for validation
    getConnectedInputs(context, connections, node.id, 'animation');
    
    // All animations should already be in context from previous executions
    setNodeOutput(context, node.id, 'scene', 'scene', node.data);
  }
}

export class ExecutionEngine {
  private executors: NodeExecutor[] = [
    new GeometryNodeExecutor(),
    new InsertNodeExecutor(),
    new AnimationNodeExecutor(),
    new SceneNodeExecutor()
  ];

  async executeFlow(nodes: Node<NodeData>[], edges: Edge[]): Promise<ExecutionContext> {
    this.validateScene(nodes);
    this.validateConnections(nodes, edges);
    
    const context = createExecutionContext();
    
    // PROFESSIONAL SOLUTION: Topological execution (each node executed once)
    const executionOrder = this.getTopologicalOrder(nodes, edges);
    
    for (const node of executionOrder) {
      if (!isNodeExecuted(context, node.id)) {
        const executor = this.getExecutor(node.type!);
        if (executor) {
          await executor.execute(node, context, edges);
          markNodeExecuted(context, node.id);
        }
      }
    }
    
    return context;
  }

  private getTopologicalOrder(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData>[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    
    // Initialize
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }
    
    // Build adjacency list and in-degree count
    for (const edge of edges) {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    
    // Kahn's algorithm for topological sorting
    const queue: Node<NodeData>[] = [];
    const result: Node<NodeData>[] = [];
    
    // Start with nodes that have no dependencies
    for (const node of nodes) {
      if (inDegree.get(node.id) === 0) {
        queue.push(node);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      // Reduce in-degree for neighbors
      for (const neighborId of adjList.get(current.id) ?? []) {
        const newInDegree = (inDegree.get(neighborId) ?? 1) - 1;
        inDegree.set(neighborId, newInDegree);
        
        if (newInDegree === 0) {
          const neighborNode = nodes.find(n => n.id === neighborId);
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

  private validateConnections(nodes: Node<NodeData>[], edges: Edge[]): void {
    // Track object -> insert mappings
    const objectToInsertMap = new Map<string, string>();
    
    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) continue;
      
      // Check for object -> multiple insert violations
      if (['triangle', 'circle', 'rectangle'].includes(sourceNode.type!) && 
          targetNode.type === 'insert') {
        
        const existingInsert = objectToInsertMap.get(sourceNode.id);
        if (existingInsert && existingInsert !== targetNode.id) {
          throw new Error(
            `Object ${sourceNode.id} cannot connect to multiple Insert nodes. ` +
            `Already connected to ${existingInsert}, attempted connection to ${targetNode.id}.`
          );
        }
        objectToInsertMap.set(sourceNode.id, targetNode.id);
      }
    }
  }

  private validateScene(nodes: Node<NodeData>[]): void {
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