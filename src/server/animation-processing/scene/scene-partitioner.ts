// src/server/animation-processing/scene/scene-partitioner.ts - Multi-scene partitioning logic
import type { NodeData, SceneAnimationTrack } from "@/shared/types";
import type { AnimationScene, SceneObject } from "@/shared/types/scene";
import type { ReactFlowNode } from "../types/graph";
import type { ExecutionContext } from "../execution-context";
import { logger } from "@/lib/logger";

export interface ScenePartition {
  sceneNode: ReactFlowNode<NodeData>;
  objects: SceneObject[];
  animations: SceneAnimationTrack[];
}

/**
 * Partitions the execution context into separate scenes based on object-to-scene mappings
 * This is the core logic for multi-scene support
 */
export function partitionObjectsByScenes(
  context: ExecutionContext, 
  sceneNodes: ReactFlowNode<NodeData>[]
): ScenePartition[] {
  logger.info('Partitioning objects by scenes', { 
    totalObjects: context.sceneObjects.length,
    totalAnimations: context.sceneAnimations.length,
    sceneCount: sceneNodes.length 
  });

  const partitions: ScenePartition[] = [];

  for (const sceneNode of sceneNodes) {
    const sceneId = sceneNode.data.identifier.id;
    
    // Objects that belong to this scene (including branched objects)
    const sceneObjects = context.sceneObjects.filter(obj => {
      const primaryScene = context.objectSceneMap.get(obj.id);
      const branchedScenes = context.objectSceneMap.get(`${obj.id}_scenes`);
      
      // Check if this scene is the primary scene or one of the branched scenes
      if (primaryScene === sceneId) {
        return true;
      }
      
      if (branchedScenes) {
        const sceneList = branchedScenes.split(',');
        return sceneList.includes(sceneId);
      }
      
      return false;
    });
    
    // Get object IDs for this scene
    const sceneObjectIds = new Set(sceneObjects.map(obj => obj.id));
    
    // Animations for this scene (based on explicit scene assignments)
    const sceneAnimations = context.sceneAnimations.filter(anim => {
      const animationId = `${anim.objectId}-${anim.type}-${anim.startTime}`;
      const assignedSceneId = context.animationSceneMap.get(animationId);
      
      // Only include animations explicitly assigned to this scene
      return assignedSceneId === sceneId;
    });
    
    logger.debug(`Scene ${sceneNode.data.identifier.displayName}`, {
      sceneId,
      objectCount: sceneObjects.length,
      animationCount: sceneAnimations.length
    });
    
    // Only include scenes that have objects
    if (sceneObjects.length > 0) {
      partitions.push({
        sceneNode,
        objects: sceneObjects,
        animations: sceneAnimations
      });
    }
  }

  logger.info('Scene partitioning completed', { 
    validScenes: partitions.length,
    totalScenes: sceneNodes.length 
  });

  return partitions;
}

/**
 * Calculates the duration for a specific scene based on its animations and scene configuration
 */
export function calculateSceneDuration(
  animations: SceneAnimationTrack[],
  sceneData: Record<string, unknown>
): number {
  // Calculate maximum animation end time
  const maxAnimationTime = animations.length > 0
    ? Math.max(...animations.map(anim => anim.startTime + anim.duration))
    : 0;

  // Use scene-specific duration if set, otherwise use animation duration with minimum padding
  const sceneDuration = typeof sceneData.duration === 'number' ? sceneData.duration : undefined;
  const minDuration = 1; // Minimum 1 second duration
  
  return sceneDuration ?? Math.max(maxAnimationTime + 0.5, minDuration);
}

/**
 * Builds an AnimationScene from a scene partition
 */
export function buildAnimationSceneFromPartition(
  partition: ScenePartition
): AnimationScene {
  const sceneData = partition.sceneNode.data as Record<string, unknown>;
  const duration = calculateSceneDuration(partition.animations, sceneData);
  
  return {
    duration,
    objects: partition.objects,
    animations: partition.animations,
    background: {
      color: typeof sceneData.backgroundColor === 'string' 
        ? sceneData.backgroundColor 
        : '#000000'
    }
  };
}
