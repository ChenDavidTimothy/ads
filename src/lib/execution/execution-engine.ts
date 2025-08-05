// src/lib/execution/execution-engine.ts - River flow execution with automatic exclusive routing
import type { Node, Edge } from "reactflow";
import type { ExecutionContext } from "./execution-context";
import { 
  createExecutionContext, 
  setNodeOutput, 
  getConnectedInputs,
  markNodeExecuted,
  isNodeExecuted,
  createObjectStream,
  setPathFilter,
  recomputeRiverFlow 
} from "./execution-context";
import type { NodeData, AnimationTrack, StreamObject, ObjectStream } from "../types/nodes";
import type { SceneAnimationTrack } from "@/animation/scene/types";

export interface NodeExecutor {
  canHandle(nodeType: string): boolean;
  execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void>;
}

// Geometry node executor - creates object streams
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
    
    // Create stream with single object
    const streamObject: StreamObject = {
      objectId: node.id,
      objectName: (node.data as Record<string, unknown>).objectName as string | undefined,
      nodeName: (node.data as Record<string, unknown>).userDefinedName as string | undefined,
      data: sceneObject,
      effectiveStartTime: 0
    };
    
    const stream = createObjectStream(node.id, 'object', [streamObject]);
    setNodeOutput(context, node.id, 'object', 'object', stream);
  }

  private buildSceneObject(node: Node<NodeData>) {
    const data = node.data as Record<string, unknown>;
    const baseObject = {
      id: node.id,
      objectName: data.objectName as string | undefined,
      nodeName: data.userDefinedName as string | undefined,
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

// Insert node executor - river flow aware
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

    const appearanceTime = data.appearanceTime as number;
    const allTimedObjects: StreamObject[] = [];
    
    // Process all input streams - only objects that flowed through filters
    for (const input of inputs) {
      for (const streamObject of input.data.objects) {
        // Update scene object with appearance time
        const objectIndex = context.sceneObjects.findIndex(obj => obj.id === streamObject.objectId);
        if (objectIndex !== -1) {
          context.sceneObjects[objectIndex].appearanceTime = appearanceTime;
        }

        // Create timed object
        const timedObject: StreamObject = {
          ...streamObject,
          effectiveStartTime: appearanceTime
        };

        allTimedObjects.push(timedObject);
      }
    }

    context.currentTime = Math.max(context.currentTime, appearanceTime);
    const stream = createObjectStream(node.id, 'timed_object', allTimedObjects);
    setNodeOutput(context, node.id, 'timed_object', 'timed_object', stream);
  }
}

// Animation node executor - supports chaining and river flow
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
    const inputs = getConnectedInputs(context, connections, node.id, 'input');
    
    if (inputs.length === 0) {
      throw new Error(`Animation node ${node.id} missing required input(s)`);
    }

    const allAnimations: SceneAnimationTrack[] = [];
    const allOutputObjects: StreamObject[] = [];
    
    // Process all input streams - respects river flow filtering
    for (const input of inputs) {
      for (const streamObject of input.data.objects) {
        const objectStartTime = streamObject.effectiveStartTime;
        const nodeDuration = data.duration as number;
        
        // Convert tracks to scene animations relative to object's effective start time
        const animations = this.convertTracksToSceneAnimations(
          (data.tracks as AnimationTrack[]) || [],
          streamObject.objectId,
          objectStartTime
        );
        allAnimations.push(...animations);
        
        // Calculate completion time for this object
        const maxAnimationEndTime = animations.length > 0 
          ? Math.max(...animations.map(a => a.startTime + a.duration))
          : objectStartTime;
        
        const completionTime = Math.max(maxAnimationEndTime, objectStartTime + nodeDuration);
        
        // Create output object for potential chaining - preserve names
        const outputObject: StreamObject = {
          ...streamObject,
          effectiveStartTime: objectStartTime,
          completionTime: completionTime
        };
        
        allOutputObjects.push(outputObject);
      }
    }

    context.sceneAnimations.push(...allAnimations);
    
    // Update context time to latest completion
    const maxCompletionTime = Math.max(
      ...allOutputObjects.map(obj => obj.completionTime || obj.effectiveStartTime),
      context.currentTime
    );
    context.currentTime = maxCompletionTime;

    const stream = createObjectStream(node.id, 'animation', allOutputObjects);
    setNodeOutput(context, node.id, 'animation', 'animation', stream);
  }

  private convertTracksToSceneAnimations(
    tracks: AnimationTrack[], 
    objectId: string, 
    objectStartTime: number
  ): SceneAnimationTrack[] {
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

// Scene node executor - final validation
class SceneNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'scene';
  }

  async execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void> {
    // Process animation inputs for validation
    const inputs = getConnectedInputs(context, connections, node.id, 'animation');
    
    // Scene validation - ensure all objects have animations
    for (const input of inputs) {
      for (const streamObject of input.data.objects) {
        const hasAnimations = context.sceneAnimations.some(
          anim => anim.objectId === streamObject.objectId
        );
        if (!hasAnimations) {
          console.warn(`Object ${streamObject.objectId} has no animations`);
        }
      }
    }
    
    const stream = createObjectStream(node.id, 'scene', []);
    setNodeOutput(context, node.id, 'scene', 'scene', stream);
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
    
    // Initialize path filters from edges and compute river flow
    this.initializeRiverFlow(context, edges);
    
    // Topological execution order
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

  private initializeRiverFlow(context: ExecutionContext, edges: Edge[]): void {
    // Initialize path filters from edge data
    for (const edge of edges) {
      const filteredEdge = edge as Edge & { pathFilter?: import("../types/ports").PathFilter };
      if (filteredEdge.pathFilter) {
        setPathFilter(context, edge.id, filteredEdge.pathFilter);
      }
    }
    
    // Initial river flow computation will be done during execution
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
    // River flow validation - ensure exclusive routing is possible
    const sourcePortBranches = new Map<string, Edge[]>();
    
    for (const edge of edges) {
      const sourceKey = `${edge.source}.${edge.sourceHandle}`;
      if (!sourcePortBranches.has(sourceKey)) {
        sourcePortBranches.set(sourceKey, []);
      }
      sourcePortBranches.get(sourceKey)!.push(edge);
    }
    
    // Validate that branching points have proper filtering
    for (const [sourceKey, branchEdges] of sourcePortBranches) {
      if (branchEdges.length > 1) {
        // Multiple branches - ensure at least one has filtering enabled
        const hasFiltering = branchEdges.some(edge => {
          const filteredEdge = edge as Edge & { pathFilter?: import("../types/ports").PathFilter };
          return filteredEdge.pathFilter?.filterEnabled;
        });
        
        if (!hasFiltering) {
          console.warn(`Multiple branches from ${sourceKey} without filtering - objects will be duplicated`);
        }
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