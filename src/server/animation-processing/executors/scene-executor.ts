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

    // CRITICAL FIX: Get or create per-scene storage for this scene
    const sceneObjects = context.sceneObjectsByScene.get(sceneNodeId) ?? [];

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const item of inputData) {
        if (typeof item === 'object' && item !== null && 'id' in item && 'appearanceTime' in item) {
          const objectId = (item as { id: string }).id;
          
          // CRITICAL FIX: Always store path-specific properties for this scene
          // Each scene gets exactly what flows to it - no more "first scene wins"
          sceneObjects.push(item as never);
          objectsAddedToThisScene++;
          
          logger.debug(`Object ${objectId} with path-specific properties stored in scene ${sceneNodeId}`, {
            objectId,
            sceneId: sceneNodeId,
            hasAnimations: !!(item as { _attachedAnimations?: unknown })._attachedAnimations,
            properties: (item as { properties?: unknown }).properties
          });
          
          // Track scene membership for validation compatibility (but properties are per-scene now)
          const existingSceneId = context.objectSceneMap.get(objectId);
          if (!existingSceneId) {
            context.objectSceneMap.set(objectId, sceneNodeId);
          } else if (existingSceneId !== sceneNodeId) {
            // Object branching to multiple scenes - track additional scenes
            const existingMappings = context.objectSceneMap.get(`${objectId}_scenes`);
            const sceneMappings = existingMappings 
              ? `${existingMappings},${sceneNodeId}` 
              : `${existingSceneId},${sceneNodeId}`;
            context.objectSceneMap.set(`${objectId}_scenes`, sceneMappings);
            
            logger.debug(`Object ${objectId} branching with different properties`, {
              previousScene: existingSceneId,
              currentScene: sceneNodeId,
              branchMappings: sceneMappings
            });
          }
        }
      }
    }

    // CRITICAL: Store the scene-specific objects back to context
    context.sceneObjectsByScene.set(sceneNodeId, sceneObjects);

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
              const animationId = `${(animation as { objectId?: string }).objectId ?? 'unknown'}-${(animation as { type?: string }).type ?? 'unknown'}-${(animation as { startTime?: number }).startTime ?? 0}`;
              context.animationSceneMap.set(animationId, sceneNodeId);
              logger.debug(`Animation ${animationId} assigned to scene ${sceneNodeId} (attached to object ${objectId})`);
            }
          }
        }
      }
    }
  }


}


