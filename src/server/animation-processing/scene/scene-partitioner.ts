// src/server/animation-processing/scene/scene-partitioner.ts - Multi-scene partitioning logic
import type { NodeData, SceneAnimationTrack } from "@/shared/types";
import type { AnimationScene, SceneObject } from "@/shared/types/scene";
import { applyOverridesToObject } from "./batch-overrides-resolver";
import type { ReactFlowNode } from "../types/graph";
import type { ExecutionContext } from "../execution-context";
import { logger } from "@/lib/logger";
import { DomainError, type DomainErrorCode } from "@/shared/errors/domain";
import {
  resolveFieldValue,
  type BatchResolveContext,
} from "./batch-overrides-resolver";

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

      // Expand default-object batch overrides ("__default_object__") to all scene objects
      // This allows per-key overrides configured without selecting a specific object
      // to apply uniformly to every object that reaches this scene.
      const DEFAULT_OBJECT_ID = "__default_object__";
      if (mergedBatchOverrides[DEFAULT_OBJECT_ID]) {
        const defaultsForAll = mergedBatchOverrides[
          DEFAULT_OBJECT_ID
        ] as Record<string, Record<string, unknown>>;
        for (const obj of sceneObjects) {
          const objectId = obj.id;
          const baseFields = (mergedBatchOverrides[objectId] ?? {}) as Record<
            string,
            Record<string, unknown>
          >;
          const mergedFields: Record<string, Record<string, unknown>> = {
            ...baseFields,
          };
          for (const [fieldPath, byKeyDefault] of Object.entries(
            defaultsForAll,
          )) {
            const current = mergedFields[fieldPath] ?? {};
            // Default values provide a baseline; object-specific entries take precedence
            mergedFields[fieldPath] = {
              ...(byKeyDefault ?? {}),
              ...current,
            };
          }
          mergedBatchOverrides[objectId] = mergedFields;
        }
        // Remove synthetic default entry after expansion
        delete mergedBatchOverrides[DEFAULT_OBJECT_ID];
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
  const batched = base.objects.filter((o) => {
    if (!o.batch) return false;
    return (
      Array.isArray((o as { batchKeys?: unknown }).batchKeys) &&
      (o as { batchKeys?: unknown[] }).batchKeys!.some(
        (k) => typeof k === "string" && k.trim() !== "",
      )
    );
  });

  logger.debug("Batch analysis", {
    nonBatchedCount: nonBatched.length,
    batchedCount: batched.length,
    batchedKeys: batched.map((o) => (o as { batchKeys?: string[] }).batchKeys),
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
    new Set(
      batched.flatMap((o) => {
        const b = o as { batchKeys?: string[] };
        return Array.isArray(b.batchKeys)
          ? b.batchKeys
              .filter((k) => typeof k === "string")
              .map((k) => k.trim())
              .filter((k) => k.length > 0)
          : [];
      }),
    ),
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
      ...batched.filter((o) => {
        const b = o as { batchKeys?: string[] };
        return Array.isArray(b.batchKeys) && b.batchKeys.includes(key);
      }),
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

  // Normalize bound field keys so Timeline.* field paths are recognized when masking overrides
  const normalizedBoundFields: Record<string, string[]> | undefined = (() => {
    if (!perObjectBoundFields) return undefined;
    const out: Record<string, string[]> = {};
    const add = (objId: string, key: string) => {
      out[objId] ??= [];
      if (!out[objId].includes(key)) out[objId].push(key);
    };
    const maybeMapTrackKey = (raw: string): string[] => {
      const mappings: Array<{ test: (s: string) => boolean; map: string }> = [
        { test: (s) => s.includes("move.from.x"), map: "Timeline.move.from.x" },
        { test: (s) => s.includes("move.from.y"), map: "Timeline.move.from.y" },
        { test: (s) => s.includes("move.to.x"), map: "Timeline.move.to.x" },
        { test: (s) => s.includes("move.to.y"), map: "Timeline.move.to.y" },
        { test: (s) => s.includes("rotate.from"), map: "Timeline.rotate.from" },
        { test: (s) => s.includes("rotate.to"), map: "Timeline.rotate.to" },
        { test: (s) => s.includes("scale.from"), map: "Timeline.scale.from" },
        { test: (s) => s.includes("scale.to"), map: "Timeline.scale.to" },
        { test: (s) => s.includes("fade.from"), map: "Timeline.fade.from" },
        { test: (s) => s.includes("fade.to"), map: "Timeline.fade.to" },
        { test: (s) => s.includes("color.from"), map: "Timeline.color.from" },
        { test: (s) => s.includes("color.to"), map: "Timeline.color.to" },
      ];
      const hits: string[] = [];
      for (const m of mappings) if (m.test(raw)) hits.push(m.map);
      return hits;
    };
    for (const [objId, list] of Object.entries(perObjectBoundFields)) {
      for (const key of list) {
        if (key.startsWith("Timeline.")) add(objId, key);
        if (key.startsWith("Canvas.")) add(objId, key);
        if (key.startsWith("Typography.")) add(objId, key);
        if (key.startsWith("Media.")) add(objId, key);
        const mapped = maybeMapTrackKey(key);
        for (const mk of mapped) add(objId, mk);
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  })();

  // Coercion helpers for Timeline overrides
  const numberCoerce = (
    value: unknown,
  ): { ok: boolean; value?: number; warn?: string } => {
    if (typeof value === "number" && Number.isFinite(value))
      return { ok: true, value };
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return { ok: true, value: parsed };
    }
    return { ok: false, warn: `Expected number, got ${typeof value}` };
  };
  const stringCoerce = (
    value: unknown,
  ): { ok: boolean; value?: string; warn?: string } => {
    if (typeof value === "string") return { ok: true, value };
    return { ok: false, warn: `Expected string, got ${typeof value}` };
  };

  // Apply Timeline per-key overrides to scene animations using the active batchKey
  const resolvedAnimations = (() => {
    if (!perObjectBatchOverrides) return partition.animations;
    const ctx: BatchResolveContext = {
      batchKey,
      perObjectBatchOverrides,
      perObjectBoundFields: normalizedBoundFields,
    };
    return partition.animations.map((anim) => {
      const objId = anim.objectId;
      switch (anim.type) {
        case "move": {
          const from = { ...anim.properties.from };
          const to = { ...anim.properties.to };
          from.x = resolveFieldValue(
            objId,
            "Timeline.move.from.x",
            from.x,
            ctx,
            numberCoerce,
          );
          from.y = resolveFieldValue(
            objId,
            "Timeline.move.from.y",
            from.y,
            ctx,
            numberCoerce,
          );
          to.x = resolveFieldValue(
            objId,
            "Timeline.move.to.x",
            to.x,
            ctx,
            numberCoerce,
          );
          to.y = resolveFieldValue(
            objId,
            "Timeline.move.to.y",
            to.y,
            ctx,
            numberCoerce,
          );
          return { ...anim, properties: { from, to } } as typeof anim;
        }
        case "rotate": {
          const from = resolveFieldValue(
            objId,
            "Timeline.rotate.from",
            anim.properties.from,
            ctx,
            numberCoerce,
          );
          const to = resolveFieldValue(
            objId,
            "Timeline.rotate.to",
            anim.properties.to,
            ctx,
            numberCoerce,
          );
          return { ...anim, properties: { from, to } } as typeof anim;
        }
        case "scale": {
          const currentFrom = anim.properties.from;
          const currentTo = anim.properties.to;
          if (
            typeof currentFrom === "number" &&
            typeof currentTo === "number"
          ) {
            const from = resolveFieldValue(
              objId,
              "Timeline.scale.from",
              currentFrom,
              ctx,
              numberCoerce,
            );
            const to = resolveFieldValue(
              objId,
              "Timeline.scale.to",
              currentTo,
              ctx,
              numberCoerce,
            );
            return { ...anim, properties: { from, to } } as typeof anim;
          }
          return anim;
        }
        case "fade": {
          const from = resolveFieldValue(
            objId,
            "Timeline.fade.from",
            anim.properties.from,
            ctx,
            numberCoerce,
          );
          const to = resolveFieldValue(
            objId,
            "Timeline.fade.to",
            anim.properties.to,
            ctx,
            numberCoerce,
          );
          return { ...anim, properties: { from, to } } as typeof anim;
        }
        case "color": {
          const from = resolveFieldValue(
            objId,
            "Timeline.color.from",
            anim.properties.from,
            ctx,
            stringCoerce,
          );
          const to = resolveFieldValue(
            objId,
            "Timeline.color.to",
            anim.properties.to,
            ctx,
            stringCoerce,
          );
          return { ...anim, properties: { from, to } } as typeof anim;
        }
        default:
          return anim;
      }
    });
  })();

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
    animations: resolvedAnimations,
    background: {
      color:
        typeof sceneData.backgroundColor === "string"
          ? sceneData.backgroundColor
          : "#000000",
    },
  };
}
