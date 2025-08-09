// src/server/animation-processing/executors/scene-executor.ts
import type { NodeData } from "@/shared/types";
import { getConnectedInputs, type ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { MissingInsertConnectionError } from "@/shared/errors/domain";
import { logger } from "@/lib/logger";

export class SceneNodeExecutor extends BaseExecutor {
  // Register scene node handlers
  protected registerHandlers(): void {
    this.registerHandler('scene', (node, context, connections) => this.executeScene(node, context, connections));
  }



  private async executeScene(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    const sceneNodeId = node.data.identifier.id;
    let objectsAddedToThisScene = 0;

    // Track which objects came through this scene for animation assignment
    const objectsInThisScene = new Set<string>();

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const item of inputData) {
        if (typeof item === 'object' && item !== null && 'id' in item && 'appearanceTime' in item) {
          const objectId = (item as { id: string }).id;
          
          // Track scene affinity for multi-scene support
          // Allow objects to exist in multiple scenes (branching from insert nodes)
          const existingSceneId = context.objectSceneMap.get(objectId);
          
          // Track that this object flows through this scene
          objectsInThisScene.add(objectId);
          
          if (!existingSceneId) {
            // First scene to claim this object - add to global objects list
            context.objectSceneMap.set(objectId, sceneNodeId);
            context.sceneObjects.push(item as never);
            objectsAddedToThisScene++;
            logger.debug(`Object ${objectId} assigned to scene ${sceneNodeId}`);
          } else if (existingSceneId !== sceneNodeId) {
            // Object already belongs to another scene - this indicates branching
            // Don't add to global list again, just track the branching
            logger.debug(`Object ${objectId} branching: already in scene ${existingSceneId}, also adding to ${sceneNodeId}`);
            
            // Store additional scene mappings for branched objects
            const existingMappings = context.objectSceneMap.get(`${objectId}_scenes`);
            const sceneMappings = existingMappings ? 
              `${existingMappings},${sceneNodeId}` : 
              `${existingSceneId},${sceneNodeId}`;
            context.objectSceneMap.set(`${objectId}_scenes`, sceneMappings);
            objectsAddedToThisScene++; // Count this as handled for this scene
          } else {
            // Same scene processing the same object again - just count it
            objectsAddedToThisScene++;
          }
        }
      }
    }

    if (objectsAddedToThisScene === 0) {
      throw new MissingInsertConnectionError(node.data.identifier.displayName, node.data.identifier.id);
    }
    
    // Extract animations that are attached to objects flowing through this scene
    // This ensures animations only go to scenes that receive them through the correct path
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const item of inputData) {
        if (typeof item === 'object' && item !== null && 'id' in item) {
          const objectId = (item as { id: string }).id;
          
          // Check if this object has attached animations
          const attachedAnimations = (item as { _attachedAnimations?: unknown })._attachedAnimations;
          if (Array.isArray(attachedAnimations)) {
            for (const animation of attachedAnimations) {
              const animationId = `${animation.objectId}-${animation.type}-${animation.startTime}`;
              context.animationSceneMap.set(animationId, sceneNodeId);
              logger.debug(`Animation ${animationId} assigned to scene ${sceneNodeId} (attached to object ${objectId})`);
            }
          }
        }
      }
    }
  }


}


