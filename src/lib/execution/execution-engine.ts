// src/lib/execution/execution-engine.ts
import type { Node, Edge } from "reactflow";
import type { ExecutionContext } from "./execution-context";
import { 
  createExecutionContext, 
  setNodeOutput, 
  getConnectedInput,
  markNodeExecuted,
  isNodeExecuted 
} from "./execution-context";
import { getNodeDefinition } from "../types/node-definitions";
import type { NodeData } from "../types/nodes";

interface ExecutionPath {
  objectId: string;
  geometryNode: Node<NodeData>;
  animationNodes: Node<NodeData>[];
}

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
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void> {
    const sceneObject = this.buildSceneObject(node);
    context.sceneObjects.push(sceneObject);
    
    // Output the geometry object
    setNodeOutput(context, node.id, 'object', 'object', sceneObject);
  }

  private buildSceneObject(node: Node<NodeData>) {
    const data = node.data as any;
    const baseObject = {
      id: node.id,
      type: node.type as "triangle" | "circle" | "rectangle",
      initialPosition: data.position,
      initialRotation: 0,
      initialScale: { x: 1, y: 1 },
      initialOpacity: 1,
    };

    switch (node.type) {
      case "triangle":
        return {
          ...baseObject,
          properties: {
            size: data.size,
            color: data.color,
            strokeColor: data.strokeColor,
            strokeWidth: data.strokeWidth,
          },
        };
      case "circle":
        return {
          ...baseObject,
          properties: {
            radius: data.radius,
            color: data.color,
            strokeColor: data.strokeColor,
            strokeWidth: data.strokeWidth,
          },
        };
      case "rectangle":
        return {
          ...baseObject,
          properties: {
            width: data.width,
            height: data.height,
            color: data.color,
            strokeColor: data.strokeColor,
            strokeWidth: data.strokeWidth,
          },
        };
      default:
        throw new Error(`Unknown geometry type: ${node.type}`);
    }
  }
}

// Animation node executor
class AnimationNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'animation';
  }

  async execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void> {
    const data = node.data as any;
    
    // Get input from single smart port
    const input = getConnectedInput(context, connections, node.id, 'input');
    
    if (!input) {
      throw new Error(`Animation node ${node.id} missing required input`);
    }

    let objectId: string;
    
    if (input.type === 'object') {
      // Direct connection from geometry object
      objectId = input.data.id;
    } else if (input.type === 'animation') {
      // Chained from previous animation - inherit object ID
      objectId = input.data[0]?.objectId; // Get from first animation in chain
      if (!objectId) {
        throw new Error(`Animation node ${node.id} cannot determine target object from animation chain`);
      }
    } else {
      throw new Error(`Animation node ${node.id} received unsupported input type: ${input.type}`);
    }

    const animations = this.convertTracksToAnimations(
      data.tracks || [],
      objectId,
      context.currentTime
    );

    context.sceneAnimations.push(...animations);
    
    // Advance time for this execution path only
    context.currentTime += data.duration;

    // Output animation for chaining
    setNodeOutput(context, node.id, 'animation', 'animation', animations);
  }

  private convertTracksToAnimations(tracks: any[], objectId: string, startTime: number) {
    return tracks.map((track: any) => ({
      objectId,
      type: track.type,
      startTime: startTime + track.startTime,
      duration: track.duration,
      easing: track.easing,
      properties: this.convertTrackProperties(track)
    }));
  }

  private convertTrackProperties(track: any) {
    switch (track.type) {
      case 'move':
        return {
          from: track.properties.from,
          to: track.properties.to,
        };
      case 'rotate':
        return {
          from: 0,
          to: 0,
          rotations: track.properties.rotations,
        };
      case 'scale':
        return {
          from: track.properties.from,
          to: track.properties.to,
        };
      case 'fade':
        return {
          from: track.properties.from,
          to: track.properties.to,
        };
      case 'color':
        return {
          from: track.properties.from,
          to: track.properties.to,
          property: track.properties.property,
        };
      default:
        return track.properties;
    }
  }
}

// Scene node executor
class SceneNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'scene';
  }

  async execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void> {
    // Scene node just collects configuration
    setNodeOutput(context, node.id, 'scene', 'scene', node.data);
  }
}

export class ExecutionEngine {
  private executors: NodeExecutor[] = [
    new GeometryNodeExecutor(),
    new AnimationNodeExecutor(),
    new SceneNodeExecutor()
  ];

  async executeFlow(nodes: Node<NodeData>[], edges: Edge[]): Promise<ExecutionContext> {
    // Validate scene requirements
    this.validateScene(nodes);
    
    // Create global context for final scene assembly
    const globalContext = createExecutionContext();
    
    // Find execution paths per geometry object (like original)
    const executionPaths = this.findExecutionPaths(nodes, edges);
    
    // Execute each path independently with separate timing
    for (const path of executionPaths) {
      const pathContext = createExecutionContext();
      pathContext.currentTime = 0; // Independent timing per path
      
      await this.executeExecutionPath(path, pathContext, nodes, edges);
      
      // Merge path results into global context
      globalContext.sceneObjects.push(...pathContext.sceneObjects);
      globalContext.sceneAnimations.push(...pathContext.sceneAnimations);
    }
    
    // Execute scene node separately (only once)
    const sceneNode = nodes.find(n => n.type === 'scene');
    if (sceneNode) {
      await this.getExecutor('scene')?.execute(sceneNode, globalContext, edges);
    }
    
    return globalContext;
  }

  private findExecutionPaths(nodes: Node<NodeData>[], edges: Edge[]): ExecutionPath[] {
    const geometryNodes = nodes.filter(n => ['triangle', 'circle', 'rectangle'].includes(n.type!));
    const paths: ExecutionPath[] = [];

    for (const geoNode of geometryNodes) {
      const connectedEdges = edges.filter(edge => edge.source === geoNode.id);
      const startingNodes = connectedEdges
        .map(edge => nodes.find(n => n.id === edge.target))
        .filter(Boolean) as Node<NodeData>[];

      if (startingNodes.length > 0) {
        paths.push({
          objectId: geoNode.id,
          geometryNode: geoNode,
          animationNodes: startingNodes
        });
      } else {
        // Geometry with no animations still needs to be in scene
        paths.push({
          objectId: geoNode.id,
          geometryNode: geoNode,
          animationNodes: []
        });
      }
    }

    return paths;
  }

  private async executeExecutionPath(
    path: ExecutionPath,
    pathContext: ExecutionContext,
    allNodes: Node<NodeData>[],
    edges: Edge[]
  ): Promise<void> {
    // Execute geometry node first
    const geometryExecutor = this.getExecutor(path.geometryNode.type!);
    if (geometryExecutor) {
      await geometryExecutor.execute(path.geometryNode, pathContext, edges);
      markNodeExecuted(pathContext, path.geometryNode.id);
    }

    // Execute animation nodes for this object
    const nodesToExecute = [...path.animationNodes];
    const executedNodes = new Set<string>();

    while (nodesToExecute.length > 0) {
      const currentNode = nodesToExecute.shift()!;
      
      if (executedNodes.has(currentNode.id)) continue;
      executedNodes.add(currentNode.id);

      const executor = this.getExecutor(currentNode.type!);
      if (executor) {
        await executor.execute(currentNode, pathContext, edges);
        
        // Find next nodes in this path
        const nextEdges = edges.filter(edge => edge.source === currentNode.id);
        const nextNodes = nextEdges
          .map(edge => allNodes.find(n => n.id === edge.target))
          .filter(node => node && node.type !== 'scene') // Scene handled separately
          .filter(Boolean) as Node<NodeData>[];
        
        nodesToExecute.push(...nextNodes);
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