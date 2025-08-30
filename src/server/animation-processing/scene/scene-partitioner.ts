// src/server/animation-processing/scene/scene-partitioner.ts - Multi-scene partitioning logic
import type { NodeData, SceneAnimationTrack } from "@/shared/types";
import type { AnimationScene, SceneObject } from "@/shared/types/scene";
import { applyOverridesToObject } from "./batch-overrides-resolver";
import type { ReactFlowNode } from "../types/graph";
import type { ExecutionContext } from "../execution-context";
import { logger } from "@/lib/logger";
import { DomainError, type DomainErrorCode } from "@/shared/errors/domain";

export interface ScenePartition {
  sceneNode: ReactFlowNode<NodeData>;
  objects: SceneObject[];
  animations: SceneAnimationTrack[];
  // Optional: per-object batch overrides collected from inputs metadata
  batchOverrides?: Record<string, Record<string, Record<string, unknown>>>;
  // Optional: list of bound fields per object to enforce resolver mask
  boundFieldsByObject?: Record<string, string[]>;
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
    const mergedBatchOverrides: Record<
      string,
      Record<string, Record<string, unknown>>
    > = {};

    // CRITICAL FIX: Prioritize metadata over global context for animation retrieval
    // Problem: Global context animations were being modified by merge nodes, affecting direct connections
    // Solution: Check input metadata first, fallback to global context only for merge node outputs
    if (edges) {
      // Fallback: For scenes with no assigned animations, try to get them from input metadata
      // This handles direct animation->scene connections that bypass merge nodes
      const incomingEdges = edges.filter((edge) => edge.target === sceneId);
      const mergedBoundFields: Record<string, string[]> = {};

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
              perObjectBatchOverrides?: Record<
                string,
                Record<string, Record<string, unknown>>
              >;
            }
          )?.perObjectBatchOverrides;
          if (perObjectBatchOverrides) {
            for (const [objectId, fields] of Object.entries(
              perObjectBatchOverrides,
            )) {
              const baseFields = mergedBatchOverrides[objectId] ?? {};
              const mergedFields: Record<string, Record<string, unknown>> = {
                ...baseFields,
              };
              for (const [fieldId, byKey] of Object.entries(fields)) {
                mergedFields[fieldId] = {
                  ...(mergedFields[fieldId] ?? {}),
                  ...byKey,
                };
              }
              mergedBatchOverrides[objectId] = mergedFields;
            }
          }
          const boundFields = (
            sourceOutput.metadata as {
              perObjectBoundFields?: Record<string, string[]>;
            }
          )?.perObjectBoundFields;
          if (boundFields) {
            for (const [objectId, fieldList] of Object.entries(boundFields)) {
              const existing = mergedBoundFields[objectId] ?? [];
              mergedBoundFields[objectId] = Array.from(
                new Set([...existing, ...fieldList.map(String)]),
              );
            }
          }
        }
      }

      // Attach bound fields to partitions via later object construction
      if (Object.keys(mergedBoundFields).length > 0) {
        // no-op placeholder; bound fields are re-collected below to maintain a single code path
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
      const boundFieldsByObject = (() => {
        if (!edges) return undefined;
        const incoming = edges.filter((e) => e.target === sceneId);
        const out: Record<string, string[]> = {};
        for (const e of incoming) {
          const so = context.nodeOutputs.get(
            `${e.source}.${e.sourceHandle ?? "output"}`,
          );
          const m = (
            so?.metadata as
              | { perObjectBoundFields?: Record<string, string[]> }
              | undefined
          )?.perObjectBoundFields;
          if (!m) continue;
          for (const [objectId, list] of Object.entries(m)) {
            const existing = out[objectId] ?? [];
            out[objectId] = Array.from(
              new Set([...existing, ...list.map(String)]),
            );
          }
        }
        return Object.keys(out).length > 0 ? out : undefined;
      })();

      partitions.push({
        sceneNode,
        objects: sceneObjects,
        animations: sceneAnimations,
        batchOverrides:
          Object.keys(mergedBatchOverrides).length > 0
            ? mergedBatchOverrides
            : undefined,
        boundFieldsByObject,
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
  const sceneId = base.sceneNode?.data?.identifier?.id;
  const sceneName =
    base.sceneNode?.data?.identifier?.displayName ?? "Unknown Scene";

  logger.debug("Partitioning by batch key", {
    sceneId,
    sceneName,
    totalObjects: base.objects.length,
    hasSceneNode: !!base.sceneNode,
  });

  const nonBatched = base.objects.filter((o) => !o.batch);
  const batched = base.objects.filter(
    (o) => o.batch && typeof o.batchKey === "string",
  );

  logger.debug("Batch analysis", {
    nonBatchedCount: nonBatched.length,
    batchedCount: batched.length,
    batchedKeys: batched.map((o) => o.batchKey),
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
    new Set(batched.map((o) => String(o.batchKey))),
  ).filter((k) => k.trim().length > 0);

  logger.debug("Extracted keys", { keys, keysCount: keys.length });

  // VALIDATION: Batched objects exist but no valid keys found
  if (keys.length === 0) {
    // Throw domain error compatible with runtime
    throw new DomainError(
      `Scene '${sceneName}' contains batched objects but no batch keys were found. Ensure batch nodes are properly configured.`,
      "ERR_SCENE_BATCH_EMPTY_KEYS" as DomainErrorCode,
      { nodeId: sceneId ?? "", nodeName: sceneName },
    );
  }

  // WARNING: Excessive key count guardrail
  const EXCESSIVE_KEY_THRESHOLD = 1000;
  if (keys.length > EXCESSIVE_KEY_THRESHOLD) {
    logger.warn(
      `Scene '${sceneName}' contains ${keys.length} unique batch keys, exceeding threshold of ${EXCESSIVE_KEY_THRESHOLD}. This may impact performance.`,
      {
        sceneId,
        sceneName,
        keyCount: keys.length,
        threshold: EXCESSIVE_KEY_THRESHOLD,
        keys: keys.slice(0, 10).join(", ") + (keys.length > 10 ? " ..." : ""),
      },
    );
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
    boundFieldsByObject: base.boundFieldsByObject,
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

  // Apply batch overrides per object using partition metadata and batch key if present
  const batchKey =
    (partition as unknown as { batchKey?: string | null }).batchKey ?? null;
  const perObjectBatchOverrides = partition.batchOverrides;
  const perObjectBoundFields = partition.boundFieldsByObject;

  const overriddenObjects: SceneObject[] = partition.objects.map((obj) =>
    applyOverridesToObject(obj, {
      batchKey,
      perObjectBatchOverrides,
      perObjectBoundFields,
    }),
  );

  let sortedObjects = overriddenObjects;
  if (layerOrder && layerOrder.length > 0) {
    // Normalize IDs to be batch-agnostic: strip trailing @<batchKey> suffix if present
    const normalizeId = (id: string): string => id.replace(/@[^@]+$/, "");

    const indexById = new Map<string, number>();
    for (let i = 0; i < layerOrder.length; i++) {
      const id = layerOrder[i];
      if (id) indexById.set(normalizeId(id), i);
    }
    // Stable sort: objects with known index ordered by index, others stay behind by original order
    sortedObjects = [...overriddenObjects]
      .map((obj, originalIndex) => ({ obj, originalIndex }))
      .sort((a, b) => {
        const aId = normalizeId(a.obj.id);
        const bId = normalizeId(b.obj.id);
        const ia = indexById.has(aId) ? indexById.get(aId)! : -1;
        const ib = indexById.has(bId) ? indexById.get(bId)! : -1;
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
