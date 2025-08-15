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
  sceneNodes: ReactFlowNode<NodeData>[],
  edges?: Array<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>
): ScenePartition[] {
  logger.info('Partitioning objects by scenes', { 
    totalScenes: sceneNodes.length,
    scenesWithObjects: context.sceneObjectsByScene.size,
    totalAnimations: context.sceneAnimations.length
  });

  const partitions: ScenePartition[] = [];

  for (const sceneNode of sceneNodes) {
    const sceneId = sceneNode.data.identifier.id;
    
    // CRITICAL FIX: Get path-specific objects directly from per-scene storage
    // OLD: context.sceneObjects.filter(...) // Global array filtering - WRONG
    // NEW: Direct retrieval of scene-specific objects with correct properties
    const sceneObjects = context.sceneObjectsByScene.get(sceneId) ?? [];
    
    // Object IDs are available directly from sceneObjects if needed
    
    // FIXED: Get animations for this scene with hybrid approach
    let sceneAnimations: SceneAnimationTrack[] = [];
    
    // CRITICAL FIX: Prioritize metadata over global context for animation retrieval
    // Problem: Global context animations were being modified by merge nodes, affecting direct connections
    // Solution: Check input metadata first, fallback to global context only for merge node outputs
    if (edges) {
      // Fallback: For scenes with no assigned animations, try to get them from input metadata
      // This handles direct animation->scene connections that bypass merge nodes
      const incomingEdges = edges.filter(edge => edge.target === sceneId);
      
      // DEBUG: Log metadata flow during scene partitioning
      console.log(`[ScenePartitioner] Scene ${sceneNode.data.identifier.displayName} (${sceneId}) metadata check:`, {
        incomingEdges: incomingEdges.map(edge => ({
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: edge.target
        })),
        edgeMetadata: incomingEdges.map(edge => {
          const sourceOutput = context.nodeOutputs.get(`${edge.source}.${edge.sourceHandle ?? 'output'}`);
          return {
            edge: `${edge.source}.${edge.sourceHandle ?? 'output'}`,
            hasMetadata: !!sourceOutput?.metadata,
            hasAnimations: !!(sourceOutput?.metadata as any)?.perObjectAnimations,
            animationKeys: Object.keys((sourceOutput?.metadata as any)?.perObjectAnimations || {}),
            animationCounts: Object.entries((sourceOutput?.metadata as any)?.perObjectAnimations || {})
              .map(([objId, tracks]) => ({
                objectId: objId,
                trackCount: (tracks as any[])?.length || 0
              }))
          };
        })
      });
      
      for (const edge of incomingEdges) {
        const sourceOutput = context.nodeOutputs.get(`${edge.source}.${edge.sourceHandle ?? 'output'}`);
        if (sourceOutput?.metadata) {
          const perObjectAnimations = (sourceOutput.metadata as { perObjectAnimations?: Record<string, SceneAnimationTrack[]> })?.perObjectAnimations;
          if (perObjectAnimations) {
            for (const animations of Object.values(perObjectAnimations)) {
              sceneAnimations.push(...animations);
            }
          }
        }
      }
    }
    
    // Fallback: If no animations found from metadata, try the global context method
    // This handles merge node outputs that rely on assigned animations
    if (sceneAnimations.length === 0) {
      const assignedAnimations = context.sceneAnimations.filter(anim => {
        const assignedSceneId = context.animationSceneMap.get(anim.id);
        return assignedSceneId === sceneId;
      });
      sceneAnimations = assignedAnimations;
    }
    
    // DEBUG: Log final scene animations after metadata processing
    console.log(`[ScenePartitioner] Scene ${sceneNode.data.identifier.displayName} (${sceneId}) final animations:`, {
      sceneId,
      objectCount: sceneObjects.length,
      animationCount: sceneAnimations.length,
      objectIds: sceneObjects.map(obj => obj.id),
      sceneAnimations: sceneAnimations.map(anim => ({
        objectId: anim.objectId,
        trackId: anim.id,
        trackType: anim.type,
        startTime: anim.startTime,
        duration: anim.duration
      })),
      objectProperties: sceneObjects.map(obj => ({ 
        id: obj.id, 
        type: obj.type,
        hasAnimations: sceneAnimations.filter(anim => anim.objectId === obj.id).length > 0
      }))
    });
    
    logger.debug(`Scene ${sceneNode.data.identifier.displayName}`, {
      sceneId,
      objectCount: sceneObjects.length,
      animationCount: sceneAnimations.length,
      objectIds: sceneObjects.map(obj => obj.id),
      objectProperties: sceneObjects.map(obj => ({ 
        id: obj.id, 
        type: obj.type,
        hasAnimations: sceneAnimations.filter(anim => anim.objectId === obj.id).length > 0
      }))
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
  const sceneData = partition.sceneNode.data as unknown as Record<string, unknown>;
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
