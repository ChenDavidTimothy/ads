// src/server/animation-processing/executors/scene-executor.ts
import type { NodeData } from "@/shared/types";
import type { SceneAnimationTrack } from "@/shared/types/scene";
import { getConnectedInputs, type ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { MissingInsertConnectionError } from "@/shared/errors/domain";
import { logger } from "@/lib/logger";

export class SceneNodeExecutor extends BaseExecutor {
  // Register scene node handlers
  protected registerHandlers(): void {
    this.registerHandler('scene', (node, context, connections) => this.executeScene(node, context, connections));
    this.registerHandler('frame', (node, context, connections) => this.executeScene(node, context, connections));
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
          sceneObjects.push(item as never);
          objectsAddedToThisScene++;

          logger.debug(`Object ${objectId} with path-specific properties stored in scene ${sceneNodeId}`, {
            objectId,
            sceneId: sceneNodeId,
            properties: (item as { properties?: unknown }).properties
          });

          // Track scene membership for validation compatibility (but properties are per-scene now)
          const existingSceneId = context.objectSceneMap.get(objectId);
          if (!existingSceneId) {
            context.objectSceneMap.set(objectId, sceneNodeId);
          } else if (existingSceneId !== sceneNodeId) {
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

    // Assign animations to this scene using per-object metadata from inputs
    for (const input of inputs) {
      const perObjectAnimations = (input.metadata as { perObjectAnimations?: Record<string, SceneAnimationTrack[]> } | undefined)?.perObjectAnimations;
      if (!perObjectAnimations) continue;
      for (const [objectId, animations] of Object.entries(perObjectAnimations)) {
        for (const animation of animations) {
          context.animationSceneMap.set(animation.id, sceneNodeId);
          logger.debug(`Animation ${animation.id} assigned to scene ${sceneNodeId} (object ${objectId})`);
        }
      }
    }
  }


}


