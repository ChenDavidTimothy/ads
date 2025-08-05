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
      // Object appears later - start invisible
      timedObject = {
        ...input.data,
        initialOpacity: 0
      };

      // Create instant appearance animation at specified time
      const appearAnimation = {
        objectId: input.data.id,
        type: 'fade' as const,
        startTime: data.appearanceTime,
        duration: 0.01, // Nearly instant
        easing: 'linear' as const,
        properties: {
          from: 0,
          to: 1
        }
      };

      context.sceneAnimations.push(appearAnimation);
    } else {
      // Object appears immediately (t=0) - fully visible
      timedObject = {
        ...input.data,
        initialOpacity: 1
      };
    }

    // Update scene object in context
    const objectIndex = context.sceneObjects.findIndex(obj => obj.id === input.data.id);
    if (objectIndex !== -1) {
      context.sceneObjects[objectIndex] = timedObject;
    }

    // CRITICAL: Advance currentTime to when object becomes present
    context.currentTime = Math.max(context.currentTime, data.appearanceTime);

    // Output the timed object
    setNodeOutput(context, node.id, 'object', 'object', timedObject);
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
    
    // Get input from object port
    const input = getConnectedInput(context, connections, node.id, 'object');
    
    if (!input) {
      throw new Error(`Animation node ${node.id} missing required object input`);
    }

    const objectId = input.data.id;

    // CRITICAL FIX: Use accumulated currentTime as base (after Insert timing)
    const animations = this.convertTracksToAnimations(
      data.tracks || [],
      objectId,
      context.currentTime
    );

    context.sceneAnimations.push(...animations);
    
    // Advance time for this execution path
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
    new InsertNodeExecutor(),
    new AnimationNodeExecutor(),
    new SceneNodeExecutor()
  ];

  async executeFlow(nodes: Node<NodeData>[], edges: Edge[]): Promise<ExecutionContext> {
    // CRITICAL FIX: Validate no invalid connections exist
    this.validateConnections(nodes, edges);
    
    // Validate scene requirements
    this.validateScene(nodes);
    
    // Create global context for final scene assembly
    const globalContext = createExecutionContext();
    
    // Find execution paths per geometry object
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

  private validateConnections(nodes: Node<NodeData>[], edges: Edge[]): void {
    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) continue;
      
      // CRITICAL FIX: Block geometry -> animation direct connections
      if (['triangle', 'circle', 'rectangle'].includes(sourceNode.type!) && 
          targetNode.type === 'animation') {
        throw new Error(`Invalid connection: ${sourceNode.type} must connect to Insert node before Animation. Direct geometry -> animation connections are not allowed.`);
      }
    }
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
        // Check if first connected node is insert
        const firstNode = startingNodes[0];
        if (firstNode?.type === 'insert') {
          paths.push({
            objectId: geoNode.id,
            geometryNode: geoNode,
            insertNode: firstNode,
            animationNodes: []
          });
        } else {
          paths.push({
            objectId: geoNode.id,
            geometryNode: geoNode,
            animationNodes: startingNodes
          });
        }
      } else {
        // Geometry with no connections still needs to be in scene
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

    // Execute insert node if present
    if (path.insertNode) {
      const insertExecutor = this.getExecutor('insert');
      if (insertExecutor) {
        await insertExecutor.execute(path.insertNode, pathContext, edges);
        markNodeExecuted(pathContext, path.insertNode.id);
        
        // Find nodes connected to insert
        const insertEdges = edges.filter(edge => edge.source === path.insertNode!.id);
        const nextNodes = insertEdges
          .map(edge => allNodes.find(n => n.id === edge.target))
          .filter(Boolean) as Node<NodeData>[];
        
        path.animationNodes.push(...nextNodes);
      }
    }

    // Execute remaining nodes in this path
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