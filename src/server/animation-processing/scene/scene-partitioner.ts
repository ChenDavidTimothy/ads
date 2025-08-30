// src/server/animation-processing/scene/scene-partitioner.ts - Multi-scene partitioning logic
import type { NodeData, SceneAnimationTrack } from "@/shared/types";
import type { AnimationScene, SceneObject, TextProperties } from "@/shared/types/scene";
import type { ReactFlowNode } from "../types/graph";
import type { ExecutionContext } from "../execution-context";
import { logger } from "@/lib/logger";

export interface ScenePartition {
  sceneNode: ReactFlowNode<NodeData>;
  objects: SceneObject[];
  animations: SceneAnimationTrack[];
  // Optional: per-object batch overrides collected from inputs metadata
  batchOverrides?: Record<string, Record<string, Record<string, unknown>>>;
}

export interface BatchedScenePartition extends ScenePartition {
  batchKey: string | null; // null for non-batched single render
}

/**
 * Partitions the execution context into separate scenes based on object-to-scene mappings
 * This is the core logic for multi-scene support
 */
export function partitionObjectsByScenes(
  context: ExecutionContext,
  sceneNodes: ReactFlowNode<NodeData>[],
  edges?: Array<{
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>,
): ScenePartition[] {
  logger.info("Partitioning objects by scenes", {
    totalScenes: sceneNodes.length,
    scenesWithObjects: context.sceneObjectsByScene.size,
    totalAnimations: context.sceneAnimations.length,
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
    // NEW: Collect per-object batch overrides from upstream inputs
    const mergedBatchOverrides: Record<string, Record<string, Record<string, unknown>>> = {};

    // CRITICAL FIX: Prioritize metadata over global context for animation retrieval
    // Problem: Global context animations were being modified by merge nodes, affecting direct connections
    // Solution: Check input metadata first, fallback to global context only for merge node outputs
    if (edges) {
      // Fallback: For scenes with no assigned animations, try to get them from input metadata
      // This handles direct animation->scene connections that bypass merge nodes
      const incomingEdges = edges.filter((edge) => edge.target === sceneId);

      for (const edge of incomingEdges) {
        const sourceOutput = context.nodeOutputs.get(
          `${edge.source}.${edge.sourceHandle ?? "output"}`,
        );
        if (sourceOutput?.metadata) {
          const perObjectAnimations = (
            sourceOutput.metadata as {
              perObjectAnimations?: Record<string, SceneAnimationTrack[]>;
            }
          )?.perObjectAnimations;
          if (perObjectAnimations) {
            for (const animations of Object.values(perObjectAnimations)) {
              sceneAnimations.push(...animations);
            }
          }
          const perObjectBatchOverrides = (
            sourceOutput.metadata as {
              perObjectBatchOverrides?: Record<string, Record<string, Record<string, unknown>>>;
            }
          )?.perObjectBatchOverrides;
          if (perObjectBatchOverrides) {
            for (const [objectId, fields] of Object.entries(perObjectBatchOverrides)) {
              const baseFields = mergedBatchOverrides[objectId] ?? {};
              const mergedFields: Record<string, Record<string, unknown>> = { ...baseFields };
              for (const [fieldId, byKey] of Object.entries(fields)) {
                mergedFields[fieldId] = { ...(mergedFields[fieldId] ?? {}), ...byKey };
              }
              mergedBatchOverrides[objectId] = mergedFields;
            }
          }
        }
      }
    }

    // Fallback: If no animations found from metadata, try the global context method
    // This handles merge node outputs that rely on assigned animations
    if (sceneAnimations.length === 0) {
      const assignedAnimations = context.sceneAnimations.filter((anim) => {
        const assignedSceneId = context.animationSceneMap.get(anim.id);
        return assignedSceneId === sceneId;
      });
      sceneAnimations = assignedAnimations;
    }

    logger.debug(`Scene ${sceneNode.data.identifier.displayName}`, {
      sceneId,
      objectCount: sceneObjects.length,
      animationCount: sceneAnimations.length,
      objectIds: sceneObjects.map((obj) => obj.id),
      objectProperties: sceneObjects.map((obj) => ({
        id: obj.id,
        type: obj.type,
        hasAnimations:
          sceneAnimations.filter((anim) => anim.objectId === obj.id).length > 0,
      })),
    });

    // Only include scenes that have objects
    if (sceneObjects.length > 0) {
      partitions.push({
        sceneNode,
        objects: sceneObjects,
        animations: sceneAnimations,
        batchOverrides: Object.keys(mergedBatchOverrides).length > 0 ? mergedBatchOverrides : undefined,
      });
    }
  }

  logger.info("Scene partitioning completed", {
    validScenes: partitions.length,
    totalScenes: sceneNodes.length,
  });

  return partitions;
}

/**
 * Partition a single-scene partition further by batchKey, returning per-key partitions.
 * If no batched objects are present, returns a single partition with batchKey=null.
 */
export function partitionByBatchKey(
  base: ScenePartition,
): BatchedScenePartition[] {
  logger.debug("Partitioning by batch key", {
    sceneId: base.sceneNode?.data?.identifier?.id,
    totalObjects: base.objects.length,
    hasSceneNode: !!base.sceneNode,
  });

  const nonBatched = base.objects.filter((o) => !o.batch);
  const batched = base.objects.filter((o) => o.batch && typeof o.batchKey === "string");

  logger.debug("Batch analysis", {
    nonBatchedCount: nonBatched.length,
    batchedCount: batched.length,
    batchedKeys: batched.map(o => o.batchKey),
  });

  if (batched.length === 0) {
    const result = [{ ...base, batchKey: null }];
    logger.debug("No batched objects, returning single partition", {
      resultCount: result.length,
      hasSceneNode: !!result[0]?.sceneNode,
    });
    return result;
  }

  const keys = Array.from(
    new Set(batched.map((o) => String(o.batchKey)))
  ).filter((k) => k.trim().length > 0);

  logger.debug("Extracted keys", { keys, keysCount: keys.length });

  if (keys.length === 0) {
    throw new Error("Batched objects present but no unique keys found");
  }

  keys.sort((a, b) => a.localeCompare(b));

  const result = keys.map((key) => ({
    sceneNode: base.sceneNode,
    animations: base.animations,
    batchKey: key,
    objects: [
      ...nonBatched,
      ...batched.filter((o) => String(o.batchKey) === key),
    ],
    batchOverrides: base.batchOverrides,
  }));

  logger.debug("Created sub-partitions", {
    keysCount: keys.length,
    resultCount: result.length,
    partitions: result.map((p, i) => ({
      index: i,
      batchKey: p.batchKey,
      objectCount: p.objects.length,
      hasSceneNode: !!p.sceneNode,
    })),
  });

  return result;
}

/**
 * Calculates the duration for a specific scene based on its animations and scene configuration
 */
export function calculateSceneDuration(
  animations: SceneAnimationTrack[],
  sceneData: Record<string, unknown>,
): number {
  // Calculate maximum animation end time
  const maxAnimationTime =
    animations.length > 0
      ? Math.max(...animations.map((anim) => anim.startTime + anim.duration))
      : 0;

  // Use scene-specific duration if set, otherwise use animation duration with minimum padding
  const sceneDuration =
    typeof sceneData.duration === "number" ? sceneData.duration : undefined;
  const minDuration = 1; // Minimum 1 second duration

  return sceneDuration ?? Math.max(maxAnimationTime + 0.5, minDuration);
}

/**
 * Builds an AnimationScene from a scene partition
 */
export function buildAnimationSceneFromPartition(
  partition: ScenePartition,
): AnimationScene {
  const sceneData = partition.sceneNode.data as unknown as Record<
    string,
    unknown
  >;
  const duration = calculateSceneDuration(partition.animations, sceneData);

  // Apply optional layer ordering from node data (back-to-front)
  const layerOrder = Array.isArray(
    (sceneData as { layerOrder?: unknown }).layerOrder,
  )
    ? ((sceneData as { layerOrder?: unknown }).layerOrder as string[])
    : undefined;

  let sortedObjects = partition.objects;
  if (layerOrder && layerOrder.length > 0) {
    const indexById = new Map<string, number>();
    for (let i = 0; i < layerOrder.length; i++) {
      const id = layerOrder[i];
      if (id) indexById.set(id, i);
    }
    // Stable sort: objects with known index ordered by index, others stay behind by original order
    sortedObjects = [...partition.objects]
      .map((obj, originalIndex) => ({ obj, originalIndex }))
      .sort((a, b) => {
        const ia = indexById.has(a.obj.id) ? indexById.get(a.obj.id)! : -1;
        const ib = indexById.has(b.obj.id) ? indexById.get(b.obj.id)! : -1;
        if (ia === ib) return a.originalIndex - b.originalIndex;
        // Lower index means further back; unknown (-1) sorts to back by staying earlier
        if (ia === -1) return -1;
        if (ib === -1) return 1;
        return ia - ib;
      })
      .map((x) => x.obj);
  }

  return {
    duration,
    objects: sortedObjects,
    animations: partition.animations,
    background: {
      color:
        typeof sceneData.backgroundColor === "string"
          ? sceneData.backgroundColor
          : "#000000",
    },
  };
}
