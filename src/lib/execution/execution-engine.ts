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
  insertNode?: Node<NodeData>;
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

// Insert node executor
class InsertNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'insert';
  }

  async execute(
    node: Node<NodeData>, 
    context: ExecutionContext, 
    connections: Edge[]
  ): Promise<void> {
    const data = node.data as any;
    const input = getConnectedInput(context, connections, node.id, 'object');
    
    if (!input) {
      throw new Error(`Insert node ${node.id} missing required object input`);
    }

    let timedObject;

    if (data.appearanceTime > 0) {
      timedObject = {
        ...input.data,
        initialOpacity: 0
      };

      const appearAnimation = {
        objectId: input.data.id,
        type: 'fade' as const,
        startTime: data.appearanceTime,
        duration: 0.01,
        easing: 'linear' as const,
        properties: {
          from: 0,
          to: 1
        }
      };

      context.sceneAnimations.push(appearAnimation);
    } else {
      timedObject = {
        ...input.data,
        initialOpacity: 1
      };
    }

    const objectIndex = context.sceneObjects.findIndex(obj => obj.id === input.data.id);
    if (objectIndex !== -1) {
      context.sceneObjects[objectIndex] = timedObject;
    }

    context.currentTime = Math.max(context.currentTime, data.appearanceTime);
    setNodeOutput(context, node.id, 'object', 'timed_object', timedObject);
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
    const input = getConnectedInput(context, connections, node.id, 'object');
    
    if (!input) {
      throw new Error(`Animation node ${node.id} missing required timed object input`);
    }

    const objectId = input.data.id;
    const animations = this.convertTracksToAnimations(
      data.tracks || [],
      objectId,
      context.currentTime
    );

    context.sceneAnimations.push(...animations);
    context.currentTime += data.duration;

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
    
    const globalContext = createExecutionContext();
    const executionPaths = this.findConnectedPaths(nodes, edges);
    
    for (const path of executionPaths) {
      const pathContext = createExecutionContext();
      pathContext.currentTime = 0;
      
      await this.executeExecutionPath(path, pathContext, nodes, edges);
      
      globalContext.sceneObjects.push(...pathContext.sceneObjects);
      globalContext.sceneAnimations.push(...pathContext.sceneAnimations);
    }
    
    const sceneNode = nodes.find(n => n.type === 'scene');
    if (sceneNode) {
      await this.getExecutor('scene')?.execute(sceneNode, globalContext, edges);
    }
    
    return globalContext;
  }

  private findConnectedPaths(nodes: Node<NodeData>[], edges: Edge[]): ExecutionPath[] {
    const sceneNode = nodes.find(n => n.type === 'scene');
    if (!sceneNode) return [];
    
    const visited = new Set<string>();
    const paths: ExecutionPath[] = [];
    
    this.traverseBackward(sceneNode, nodes, edges, visited, paths);
    return paths;
  }

  private traverseBackward(
    currentNode: Node<NodeData>,
    nodes: Node<NodeData>[],
    edges: Edge[],
    visited: Set<string>,
    paths: ExecutionPath[]
  ): void {
    if (visited.has(currentNode.id)) return;
    visited.add(currentNode.id);

    const incomingEdges = edges.filter(edge => edge.target === currentNode.id);
    
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;

      if (['triangle', 'circle', 'rectangle'].includes(sourceNode.type!)) {
        const path = this.buildExecutionPath(sourceNode, nodes, edges);
        if (path) paths.push(path);
      } else {
        this.traverseBackward(sourceNode, nodes, edges, visited, paths);
      }
    }
  }

  private buildExecutionPath(
    geometryNode: Node<NodeData>,
    nodes: Node<NodeData>[],
    edges: Edge[]
  ): ExecutionPath | null {
    const path: ExecutionPath = {
      objectId: geometryNode.id,
      geometryNode,
      animationNodes: []
    };

    const nextEdges = edges.filter(edge => edge.source === geometryNode.id);
    if (nextEdges.length === 0) return path;

    const nextNode = nodes.find(n => n.id === nextEdges[0]!.target);
    if (!nextNode) return path;

    if (nextNode.type === 'insert') {
      path.insertNode = nextNode;
      
      const insertEdges = edges.filter(edge => edge.source === nextNode.id);
      for (const edge of insertEdges) {
        const animNode = nodes.find(n => n.id === edge.target);
        if (animNode && animNode.type === 'animation') {
          path.animationNodes.push(animNode);
        }
      }
    }

    return path;
  }

  private async executeExecutionPath(
    path: ExecutionPath,
    pathContext: ExecutionContext,
    allNodes: Node<NodeData>[],
    edges: Edge[]
  ): Promise<void> {
    const geometryExecutor = this.getExecutor(path.geometryNode.type!);
    if (geometryExecutor) {
      await geometryExecutor.execute(path.geometryNode, pathContext, edges);
      markNodeExecuted(pathContext, path.geometryNode.id);
    }

    if (path.insertNode) {
      const insertExecutor = this.getExecutor('insert');
      if (insertExecutor) {
        await insertExecutor.execute(path.insertNode, pathContext, edges);
        markNodeExecuted(pathContext, path.insertNode.id);
      }
    }

    for (const animNode of path.animationNodes) {
      const executor = this.getExecutor(animNode.type!);
      if (executor) {
        await executor.execute(animNode, pathContext, edges);
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