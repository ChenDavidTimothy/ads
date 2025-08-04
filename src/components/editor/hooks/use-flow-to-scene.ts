import { useCallback } from "react";
import type { Node, Edge } from "reactflow";
import type { AnimationScene } from "@/animation/scene/scene";
import type { AnimationTrack } from "../nodes/animation-node";

// Generic execution interfaces
interface ExecutionContext {
  currentTime: number;
  objectId: string;
  objects: Map<string, any>; // Scene objects
  animations: any[];
  variables: Map<string, any>; // For future data/logic nodes
  globalState: Map<string, any>; // Shared state across all executions
}

interface ExecutionResult {
  animations?: any[]; // New animations to add
  timeAdvance: number; // How much time this node consumes
  nextNodes: string[]; // Which nodes to execute next (enables branching)
  variables?: Map<string, any>; // Modified/new variables
  shouldContinue: boolean; // Whether to continue execution
}

interface ExecutableNodeHandler {
  execute(node: Node, context: ExecutionContext, edges: Edge[]): ExecutionResult;
  canHandle(nodeType: string): boolean;
}

// Execution graph traversal
interface ExecutionPath {
  objectId: string;
  startingNodes: Node[];
}

export function useFlowToScene() {
  const convertFlowToScene = useCallback((nodes: Node[], edges: Edge[]): AnimationScene | null => {
    // Find scene node and validate single scene constraint
    const sceneNodes = nodes.filter(node => node.type === "scene");
    if (sceneNodes.length === 0) {
      throw new Error("Scene node is required");
    }
    if (sceneNodes.length > 1) {
      throw new Error("Only one scene node allowed per workspace");
    }
    const sceneNode = sceneNodes[0]!;

    // Get geometry nodes (scene objects)
    const geometryNodes = nodes.filter(node => 
      ["triangle", "circle", "rectangle"].includes(node.type!)
    );

    // Build scene objects
    const objects = geometryNodes.map(node => buildSceneObject(node));

    // Find execution paths starting from each geometry object
    const executionPaths = findExecutionPaths(geometryNodes, nodes, edges);

    // Execute all paths and collect results
    const allAnimations: any[] = [];
    const nodeHandlers = createNodeHandlers();

    for (const path of executionPaths) {
      const pathAnimations = executeExecutionPath(path, nodeHandlers, edges, nodes);
      allAnimations.push(...pathAnimations);
    }

    // Calculate total scene duration
    const maxAnimationTime = allAnimations.length > 0 
      ? Math.max(...allAnimations.map(anim => anim.startTime + anim.duration))
      : 0;
    const totalDuration = Math.max(maxAnimationTime, sceneNode.data.duration);

    // Validate that all animations have valid object connections
    const objectIds = new Set(objects.map(obj => obj.id));
    for (const animation of allAnimations) {
      if (!objectIds.has(animation.objectId)) {
        throw new Error(`Animation references unknown object: ${animation.objectId}`);
      }
    }

    // Build final scene
    const scene: AnimationScene = {
      duration: totalDuration,
      objects,
      animations: allAnimations,
      background: {
        color: sceneNode.data.backgroundColor,
      },
    };

    return scene;
  }, []);

  return { convertFlowToScene };
}

// Find all execution paths starting from geometry objects
function findExecutionPaths(geometryNodes: Node[], allNodes: Node[], edges: Edge[]): ExecutionPath[] {
  const paths: ExecutionPath[] = [];

  for (const geoNode of geometryNodes) {
    // Find nodes directly connected to this geometry object
    const connectedEdges = edges.filter(edge => edge.source === geoNode.id);
    const startingNodes = connectedEdges
      .map(edge => allNodes.find(n => n.id === edge.target))
      .filter(Boolean) as Node[];

    if (startingNodes.length > 0) {
      paths.push({
        objectId: geoNode.id,
        startingNodes
      });
    }
  }

  return paths;
}

// Execute a complete execution path and return all animations
function executeExecutionPath(
  path: ExecutionPath, 
  handlers: ExecutableNodeHandler[], 
  edges: Edge[], 
  allNodes: Node[]
): any[] {
  const context: ExecutionContext = {
    currentTime: 0,
    objectId: path.objectId,
    objects: new Map(),
    animations: [],
    variables: new Map(),
    globalState: new Map()
  };

  // Start execution from all starting nodes (they run in parallel at time 0)
  const nodesToExecute = [...path.startingNodes];
  const executedNodes = new Set<string>();

  while (nodesToExecute.length > 0) {
    const currentNode = nodesToExecute.shift()!;
    
    if (executedNodes.has(currentNode.id)) continue;
    executedNodes.add(currentNode.id);

    // Find appropriate handler for this node type
    const handler = handlers.find(h => h.canHandle(currentNode.type!));
    if (!handler) {
      throw new Error(`No handler found for node type: ${currentNode.type}`);
    }

    // Execute the node
    const result = handler.execute(currentNode, context, edges);

    // Apply results to context
    if (result.animations) {
      context.animations.push(...result.animations);
    }
    if (result.variables) {
      result.variables.forEach((value, key) => {
        context.variables.set(key, value);
      });
    }

    // Advance time for sequential execution
    context.currentTime += result.timeAdvance;

    // Add next nodes to execution queue if we should continue
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

// Create handlers for different node types
function createNodeHandlers(): ExecutableNodeHandler[] {
  return [
    // Animation node handler
    {
      canHandle: (nodeType: string) => nodeType === 'animation',
      execute: (node: Node, context: ExecutionContext, edges: Edge[]): ExecutionResult => {
        const tracks: AnimationTrack[] = node.data.tracks || [];
        const animations = tracks.map(track => ({
          objectId: context.objectId,
          type: track.type,
          startTime: context.currentTime + track.startTime,
          duration: track.duration,
          easing: track.easing,
          properties: convertTrackProperties(track)
        }));

        // Find next nodes in the graph  
        const nextNodes = findNextNodeIds(node.id, edges);

        return {
          animations,
          timeAdvance: node.data.duration,
          nextNodes,
          shouldContinue: true
        };
      }
    },

    // Future node handlers can be added here:
    
    // Logic node handler (example)
    // {
    //   canHandle: (nodeType: string) => nodeType === 'if-else',
    //   execute: (node: Node, context: ExecutionContext): ExecutionResult => {
    //     const condition = evaluateCondition(node.data.condition, context);
    //     const nextNodeId = condition ? node.data.trueNode : node.data.falseNode;
    //     
    //     return {
    //       timeAdvance: 0, // Logic nodes don't consume time
    //       nextNodes: [nextNodeId],
    //       shouldContinue: true
    //     };
    //   }
    // },

    // Data node handler (example)
    // {
    //   canHandle: (nodeType: string) => nodeType === 'data-source',
    //   execute: (node: Node, context: ExecutionContext): ExecutionResult => {
    //     const data = fetchExternalData(node.data.source);
    //     const variables = new Map();
    //     variables.set(node.data.outputVariable, data);
    //     
    //     const nextNodes = findNextNodeIds(node.id, edges);
    //     
    //     return {
    //       timeAdvance: 0,
    //       nextNodes,
    //       variables,
    //       shouldContinue: true
    //     };
    //   }
    // },

    // Scene node handler (terminal node)
    {
      canHandle: (nodeType: string) => nodeType === 'scene',
      execute: (node: Node, context: ExecutionContext, edges: Edge[]): ExecutionResult => {
        return {
          timeAdvance: 0,
          nextNodes: [],
          shouldContinue: false // Terminal node
        };
      }
    }
  ];
}

// Helper function to find next nodes in execution graph
function findNextNodeIds(currentNodeId: string, edges: Edge[]): string[] {
  return edges
    .filter(edge => edge.source === currentNodeId)
    .map(edge => edge.target);
}

// Build scene object from geometry node
function buildSceneObject(node: Node) {
  const baseObject = {
    id: node.id,
    type: node.type as "triangle" | "circle" | "rectangle",
    initialPosition: node.data.position,
    initialRotation: 0,
    initialScale: { x: 1, y: 1 },
    initialOpacity: 1,
  };

  switch (node.type) {
    case "triangle":
      return {
        ...baseObject,
        properties: {
          size: node.data.size,
          color: node.data.color,
          strokeColor: node.data.strokeColor,
          strokeWidth: node.data.strokeWidth,
        },
      };
    case "circle":
      return {
        ...baseObject,
        properties: {
          radius: node.data.radius,
          color: node.data.color,
          strokeColor: node.data.strokeColor,
          strokeWidth: node.data.strokeWidth,
        },
      };
    case "rectangle":
      return {
        ...baseObject,
        properties: {
          width: node.data.width,
          height: node.data.height,
          color: node.data.color,
          strokeColor: node.data.strokeColor,
          strokeWidth: node.data.strokeWidth,
        },
      };
    default:
      throw new Error(`Unknown geometry type: ${node.type}`);
  }
}

// Convert animation track properties (unchanged)
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