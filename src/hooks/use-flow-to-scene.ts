import { useCallback } from "react";
import type { Node, Edge } from "reactflow";
import type { AnimationScene } from "@/animation/scene/scene";
import type { AnimationTrack, NodeData, GeometryNodeData, AnimationNodeData, SceneNodeData } from "@/lib/types/nodes";

interface ExecutionContext {
  currentTime: number;
  objectId: string;
  objects: Map<string, any>;
  animations: any[];
  variables: Map<string, any>;
  globalState: Map<string, any>;
}

interface ExecutionResult {
  animations?: any[];
  timeAdvance: number;
  nextNodes: string[];
  variables?: Map<string, any>;
  shouldContinue: boolean;
}

interface ExecutableNodeHandler {
  execute(node: Node<NodeData>, context: ExecutionContext, edges: Edge[]): ExecutionResult;
  canHandle(nodeType: string): boolean;
}

interface ExecutionPath {
  objectId: string;
  startingNodes: Node<NodeData>[];
}

export function useFlowToScene() {
  const convertFlowToScene = useCallback((nodes: Node<NodeData>[], edges: Edge[]): AnimationScene | null => {
    const sceneNodes = nodes.filter(node => node.type === "scene");
    if (sceneNodes.length === 0) {
      throw new Error("Scene node is required");
    }
    if (sceneNodes.length > 1) {
      throw new Error("Only one scene node allowed per workspace");
    }
    const sceneNode = sceneNodes[0]!;
    const sceneData = sceneNode.data as SceneNodeData;

    const geometryNodes = nodes.filter(node => 
      ["triangle", "circle", "rectangle"].includes(node.type!)
    );

    const objects = geometryNodes.map(node => buildSceneObject(node));
    const executionPaths = findExecutionPaths(geometryNodes, nodes, edges);
    const allAnimations: any[] = [];
    const nodeHandlers = createNodeHandlers();

    for (const path of executionPaths) {
      const pathAnimations = executeExecutionPath(path, nodeHandlers, edges, nodes);
      allAnimations.push(...pathAnimations);
    }

    const maxAnimationTime = allAnimations.length > 0 
      ? Math.max(...allAnimations.map(anim => anim.startTime + anim.duration))
      : 0;
    const totalDuration = Math.max(maxAnimationTime, sceneData.duration);

    const objectIds = new Set(objects.map(obj => obj.id));
    for (const animation of allAnimations) {
      if (!objectIds.has(animation.objectId)) {
        throw new Error(`Animation references unknown object: ${animation.objectId}`);
      }
    }

    const scene: AnimationScene = {
      duration: totalDuration,
      objects,
      animations: allAnimations,
      background: {
        color: sceneData.backgroundColor,
      },
    };

    return scene;
  }, []);

  return { convertFlowToScene };
}

function findExecutionPaths(geometryNodes: Node<NodeData>[], allNodes: Node<NodeData>[], edges: Edge[]): ExecutionPath[] {
  const paths: ExecutionPath[] = [];

  for (const geoNode of geometryNodes) {
    const connectedEdges = edges.filter(edge => edge.source === geoNode.id);
    const startingNodes = connectedEdges
      .map(edge => allNodes.find(n => n.id === edge.target))
      .filter(Boolean) as Node<NodeData>[];

    if (startingNodes.length > 0) {
      paths.push({
        objectId: geoNode.id,
        startingNodes
      });
    }
  }

  return paths;
}

function executeExecutionPath(
  path: ExecutionPath, 
  handlers: ExecutableNodeHandler[], 
  edges: Edge[], 
  allNodes: Node<NodeData>[]
): any[] {
  const context: ExecutionContext = {
    currentTime: 0,
    objectId: path.objectId,
    objects: new Map(),
    animations: [],
    variables: new Map(),
    globalState: new Map()
  };

  const nodesToExecute = [...path.startingNodes];
  const executedNodes = new Set<string>();

  while (nodesToExecute.length > 0) {
    const currentNode = nodesToExecute.shift()!;
    
    if (executedNodes.has(currentNode.id)) continue;
    executedNodes.add(currentNode.id);

    const handler = handlers.find(h => h.canHandle(currentNode.type!));
    if (!handler) {
      throw new Error(`No handler found for node type: ${currentNode.type}`);
    }

    const result = handler.execute(currentNode, context, edges);

    if (result.animations) {
      context.animations.push(...result.animations);
    }
    if (result.variables) {
      result.variables.forEach((value, key) => {
        context.variables.set(key, value);
      });
    }

    context.currentTime += result.timeAdvance;

    if (result.shouldContinue) {
      for (const nextNodeId of result.nextNodes) {
        const nextNode = allNodes.find(n => n.id === nextNodeId);
        if (nextNode && !executedNodes.has(nextNodeId)) {
          nodesToExecute.push(nextNode);
        }
      }
    }
  }

  return context.animations;
}

function createNodeHandlers(): ExecutableNodeHandler[] {
  return [
    {
      canHandle: (nodeType: string) => nodeType === 'animation',
      execute: (node: Node<NodeData>, context: ExecutionContext, edges: Edge[]): ExecutionResult => {
        const data = node.data as AnimationNodeData;
        const tracks: AnimationTrack[] = data.tracks || [];
        const animations = tracks.map(track => ({
          objectId: context.objectId,
          type: track.type,
          startTime: context.currentTime + track.startTime,
          duration: track.duration,
          easing: track.easing,
          properties: convertTrackProperties(track)
        }));

        const nextNodes = findNextNodeIds(node.id, edges);

        return {
          animations,
          timeAdvance: data.duration,
          nextNodes,
          shouldContinue: true
        };
      }
    },
    {
      canHandle: (nodeType: string) => nodeType === 'scene',
      execute: (node: Node<NodeData>, context: ExecutionContext, edges: Edge[]): ExecutionResult => {
        return {
          timeAdvance: 0,
          nextNodes: [],
          shouldContinue: false
        };
      }
    }
  ];
}

function findNextNodeIds(currentNodeId: string, edges: Edge[]): string[] {
  return edges
    .filter(edge => edge.source === currentNodeId)
    .map(edge => edge.target);
}

function buildSceneObject(node: Node<NodeData>) {
  const data = node.data as GeometryNodeData;
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
          size: (data as any).size,
          color: data.color,
          strokeColor: data.strokeColor,
          strokeWidth: data.strokeWidth,
        },
      };
    case "circle":
      return {
        ...baseObject,
        properties: {
          radius: (data as any).radius,
          color: data.color,
          strokeColor: data.strokeColor,
          strokeWidth: data.strokeWidth,
        },
      };
    case "rectangle":
      return {
        ...baseObject,
        properties: {
          width: (data as any).width,
          height: (data as any).height,
          color: data.color,
          strokeColor: data.strokeColor,
          strokeWidth: data.strokeWidth,
        },
      };
    default:
      throw new Error(`Unknown geometry type: ${node.type}`);
  }
}

function convertTrackProperties(track: AnimationTrack) {
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