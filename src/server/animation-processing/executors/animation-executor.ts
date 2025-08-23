// src/server/animation-processing/executors/animation-executor.ts
import type {
  NodeData,
  AnimationTrack,
  SceneAnimationTrack,
} from "@/shared/types";
import {
  setNodeOutput,
  getConnectedInputs,
  type ExecutionContext,
  type ExecutionValue,
} from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import {
  convertTracksToSceneAnimations,
  mergeCursorMaps,
} from "../scene/scene-assembler";
import type {
  PerObjectAssignments,
  ObjectAssignments,
} from "@/shared/properties/assignments";
import { mergeObjectAssignments } from "@/shared/properties/assignments";
import { setByPath } from "@/shared/utils/object-path";
import { deleteByPath } from "@/shared/utils/object-path";
import { logger } from "@/lib/logger";
import type { SceneObject, TextProperties } from "@/shared/types/scene";
import { createServiceClient } from "@/utils/supabase/service";
import { loadImage } from "canvas";
import { resolveInitialObject } from "@/shared/properties/resolver";
import {
  resolveBindingLookupId,
  getObjectBindingKeys,
  pickAssignmentsForObject,
  normalizeObjectId,
  mergePerObjectAssignments,
} from "@/shared/properties/override-utils";

// Safe deep clone that preserves types without introducing `any`
function deepClone<T>(value: T): T {
  try {
    // Prefer native structuredClone when available
    return structuredClone(value);
  } catch {
    // Fallback to JSON-based clone for plain data
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export class AnimationNodeExecutor extends BaseExecutor {
  // Register animation node handlers
  protected registerHandlers(): void {
    this.registerHandler("animation", this.executeAnimation.bind(this));
    this.registerHandler("typography", this.executeTypography.bind(this));
    this.registerHandler("media", this.executeMedia.bind(this));
  }

  private async executeMedia(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      "input",
    );

    logger.info(
      `Applying media processing: ${node.data.identifier.displayName}`,
    );

    // Variable binding resolution (identical to Typography pattern)
    const bindings =
      (data.variableBindings as
        | Record<string, { target?: string; boundResultNodeId?: string }>
        | undefined) ?? {};
    const bindingsByObject =
      (data.variableBindingsByObject as
        | Record<
            string,
            Record<string, { target?: string; boundResultNodeId?: string }>
          >
        | undefined) ?? {};

    const readVarGlobal = (key: string): unknown => {
      const rid = bindings[key]?.boundResultNodeId;
      if (!rid) return undefined;
      return (
        context.nodeOutputs.get(`${rid}.output`) ??
        context.nodeOutputs.get(`${rid}.result`)
      )?.data;
    };

    const readVarForObject =
      (objectId: string | undefined) =>
      (key: string): unknown => {
        if (!objectId) return readVarGlobal(key);
        const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
        if (rid)
          return (
            context.nodeOutputs.get(`${rid}.output`) ??
            context.nodeOutputs.get(`${rid}.result`)
          )?.data;
        return readVarGlobal(key);
      };

    // Build Media overrides with ALL properties
    const baseOverrides: {
      imageAssetId?: string;
      cropX?: number;
      cropY?: number;
      cropWidth?: number;
      cropHeight?: number;
      displayWidth?: number;
      displayHeight?: number;
    } = {
      imageAssetId: data.imageAssetId as string,
      cropX: data.cropX as number,
      cropY: data.cropY as number,
      cropWidth: data.cropWidth as number,
      cropHeight: data.cropHeight as number,
      displayWidth: data.displayWidth as number,
      displayHeight: data.displayHeight as number,
    };

    // Apply all global binding keys generically into baseOverrides
    const globalKeys = Object.keys(bindings);
    const nodeOverrides = JSON.parse(
      JSON.stringify(baseOverrides),
    ) as typeof baseOverrides;

    for (const key of globalKeys) {
      const val = readVarGlobal(key);
      if (val === undefined) continue;

      // Type-safe property setting for ALL Media overrides
      switch (key) {
        case "imageAssetId":
          if (typeof val === "string") nodeOverrides.imageAssetId = val;
          break;
        case "cropX":
          if (typeof val === "number") nodeOverrides.cropX = val;
          break;
        case "cropY":
          if (typeof val === "number") nodeOverrides.cropY = val;
          break;
        case "cropWidth":
          if (typeof val === "number") nodeOverrides.cropWidth = val;
          break;
        case "cropHeight":
          if (typeof val === "number") nodeOverrides.cropHeight = val;
          break;
        case "displayWidth":
          if (typeof val === "number") nodeOverrides.displayWidth = val;
          break;
        case "displayHeight":
          if (typeof val === "number") nodeOverrides.displayHeight = val;
          break;
      }
    }

    const processedObjects: unknown[] = [];

    // Read optional per-object assignments metadata (from upstream)
    const upstreamAssignments: PerObjectAssignments | undefined =
      this.extractPerObjectAssignmentsFromInputs(inputs);
    const nodeAssignments: PerObjectAssignments | undefined =
      data.perObjectAssignments as PerObjectAssignments | undefined;
    const mergedAssignments = mergePerObjectAssignments(
      upstreamAssignments,
      nodeAssignments,
      mergeObjectAssignments,
    );

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const obj of inputData) {
        if (this.isImageObject(obj)) {
          const processed = await this.processImageObject(
            obj,
            nodeOverrides,
            mergedAssignments,
            bindingsByObject,
            readVarForObject,
            context,
          );
          processedObjects.push(processed);
        } else {
          // Pass through non-image objects unchanged
          processedObjects.push(obj);
        }
      }
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      processedObjects,
      {
        perObjectTimeCursor: this.extractCursorsFromInputs(inputs),
        perObjectAnimations: this.extractPerObjectAnimationsFromInputs(inputs),
        perObjectAssignments: mergedAssignments,
      },
    );

    logger.info(
      `Media processing applied: ${processedObjects.length} objects processed`,
    );
  }

  // Helper methods for media processing
  private isImageObject(obj: unknown): obj is SceneObject {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "type" in obj &&
      (obj as { type: string }).type === "image" &&
      "initialPosition" in obj &&
      "initialRotation" in obj &&
      "initialScale" in obj &&
      "initialOpacity" in obj &&
      "properties" in obj
    );
  }

  private async processImageObject(
    obj: SceneObject,
    nodeOverrides: {
      imageAssetId?: string;
      cropX?: number;
      cropY?: number;
      cropWidth?: number;
      cropHeight?: number;
      displayWidth?: number;
      displayHeight?: number;
    },
    assignments: PerObjectAssignments | undefined,
    bindingsByObject: Record<
      string,
      Record<string, { target?: string; boundResultNodeId?: string }>
    >,
    readVarForObject: (
      objectId: string | undefined,
    ) => (key: string) => unknown,
    _context: ExecutionContext,
  ): Promise<SceneObject> {
    const objectId = obj.id;
    const objectIdNoPrefix = normalizeObjectId(String(objectId));

    // Debug logging to check object structure
    logger.debug(`Processing image object ${objectId}:`, {
      hasInitialPosition: !!obj.initialPosition,
      hasInitialRotation: !!obj.initialRotation,
      hasInitialScale: !!obj.initialScale,
      hasInitialOpacity: !!obj.initialOpacity,
      initialPosition: obj.initialPosition,
      type: obj.type,
    });

    // Normalize binding lookup ID to support assignments keyed by base node id
    const bindingLookupId = resolveBindingLookupId(
      bindingsByObject as Record<string, unknown>,
      String(objectId),
    );

    const reader = readVarForObject(bindingLookupId);

    // Build object-specific overrides
    const objectOverrides = { ...nodeOverrides };
    const objectKeys = getObjectBindingKeys(
      bindingsByObject as Record<string, Record<string, unknown>>,
      String(objectId),
    );

    for (const key of objectKeys) {
      const val = reader(key);
      if (val === undefined) continue;

      // Apply object-level bindings
      switch (key) {
        case "imageAssetId":
          if (typeof val === "string") objectOverrides.imageAssetId = val;
          break;
        case "cropX":
          if (typeof val === "number") objectOverrides.cropX = val;
          break;
        case "cropY":
          if (typeof val === "number") objectOverrides.cropY = val;
          break;
        case "cropWidth":
          if (typeof val === "number") objectOverrides.cropWidth = val;
          break;
        case "cropHeight":
          if (typeof val === "number") objectOverrides.cropHeight = val;
          break;
        case "displayWidth":
          if (typeof val === "number") objectOverrides.displayWidth = val;
          break;
        case "displayHeight":
          if (typeof val === "number") objectOverrides.displayHeight = val;
          break;
      }
    }

    // Apply per-object assignments (manual overrides)
    // Handle object ID prefix mismatch - try both prefixed and non-prefixed versions
    const assignment = pickAssignmentsForObject(assignments, String(objectId));
    const initial = assignment?.initial ?? {};

    // Use the standard resolveInitialObject function like canvas executor
    // Create canvas-style overrides for media-specific properties
    const mediaCanvasOverrides = {
      // Transform properties are handled by resolveInitialObject
      position: objectOverrides.position,
      rotation: objectOverrides.rotation,
      scale: objectOverrides.scale,
      opacity: objectOverrides.opacity,
      // Media doesn't use canvas color properties
      fillColor: "#4444ff",
      strokeColor: "#ffffff", 
      strokeWidth: 2,
    };

    const {
      initialPosition,
      initialRotation,
      initialScale,
      initialOpacity,
      properties: resolvedProperties,
    } = resolveInitialObject(obj, mediaCanvasOverrides, assignment);

    // Merge media-specific overrides for properties not handled by resolveInitialObject
    const finalOverrides = { ...objectOverrides, ...initial };

    // Load asset if specified
    let imageData: { url: string; width: number; height: number } | undefined;

    if (finalOverrides.imageAssetId) {
      try {
        // Fetch asset from database (reuse logic from current image executor)
        const supabase = createServiceClient();
        const result = await supabase
          .from("user_assets")
          .select("*")
          .eq("id", finalOverrides.imageAssetId)
          .single();

        const { data: asset, error } = result as {
          data: unknown;
          error: unknown;
        };

        if (!error && asset && typeof asset === "object" && asset !== null) {
          const assetRecord = asset as Record<string, unknown>;
          const bucketName = assetRecord.bucket_name as string | undefined;
          const storagePath = assetRecord.storage_path as string | undefined;

          if (bucketName && storagePath) {
            // Get signed URL
            const { data: signedUrl, error: urlError } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(storagePath, 60 * 60);

            if (!urlError && signedUrl) {
              // Load image to get dimensions
              try {
                const image = await loadImage(signedUrl.signedUrl);
                imageData = {
                  url: signedUrl.signedUrl,
                  width: image.width,
                  height: image.height,
                };
              } catch (imageError) {
                console.warn(
                  `Failed to load image: ${finalOverrides.imageAssetId}`,
                  imageError,
                );
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          `Failed to process asset: ${finalOverrides.imageAssetId}`,
          error,
        );
      }
    }

    // Apply media processing to the image object using resolved properties
    const processed = {
      ...obj,
      // Use properly resolved transform properties with correct precedence
      initialPosition,
      initialRotation,
      initialScale,
      initialOpacity,
      properties: {
        ...resolvedProperties,
        // Override with media-specific properties
        imageUrl: imageData?.url,
        originalWidth: imageData?.width ?? 100,
        originalHeight: imageData?.height ?? 100,
        assetId: finalOverrides.imageAssetId,

        // Crop properties
        cropX: finalOverrides.cropX ?? 0,
        cropY: finalOverrides.cropY ?? 0,
        cropWidth: finalOverrides.cropWidth ?? 0,
        cropHeight: finalOverrides.cropHeight ?? 0,

        // Display properties
        displayWidth: finalOverrides.displayWidth ?? 0,
        displayHeight: finalOverrides.displayHeight ?? 0,
      },
    };

    // Debug logging to verify processed object structure
    logger.debug(`Processed image object ${objectId}:`, {
      hasInitialPosition: !!processed.initialPosition,
      hasInitialRotation: !!processed.initialRotation,
      hasInitialScale: !!processed.initialScale,
      hasInitialOpacity: !!processed.initialOpacity,
      initialPosition: processed.initialPosition,
      type: processed.type,
    });

    return processed;
  }

  private async executeAnimation(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      "input",
    );

    // Resolve variable bindings from upstream Result nodes
    const bindings =
      (data.variableBindings as
        | Record<string, { target?: string; boundResultNodeId?: string }>
        | undefined) ?? {};
    const bindingsByObject =
      (data.variableBindingsByObject as
        | Record<
            string,
            Record<string, { target?: string; boundResultNodeId?: string }>
          >
        | undefined) ?? {};
    const readVarGlobal = (key: string): unknown => {
      const rid = bindings[key]?.boundResultNodeId;
      if (!rid) return undefined;
      const val = (
        context.nodeOutputs.get(`${rid}.output`) ??
        context.nodeOutputs.get(`${rid}.result`)
      )?.data;
      return val;
    };
    const readVarForObject =
      (objectId: string | undefined) =>
      (key: string): unknown => {
        if (!objectId) return readVarGlobal(key);
        const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
        if (rid)
          return (
            context.nodeOutputs.get(`${rid}.output`) ??
            context.nodeOutputs.get(`${rid}.result`)
          )?.data;
        return readVarGlobal(key);
      };

    // Resolve duration binding if present (global only)
    const boundDuration = readVarGlobal("duration");
    if (typeof boundDuration === "number") {
      data.duration = boundDuration;
    }

    // Build a list of binding keys to apply at global level
    const globalBindingKeys = Object.keys(bindings);

    // Clone tracks and apply generic per-track bindings using key prefixes
    const originalTracks: AnimationTrack[] =
      (data.tracks as AnimationTrack[]) || [];

    const applyBindingsToTrack = (
      t: AnimationTrack,
      keys: string[],
      reader: (k: string) => unknown,
    ): AnimationTrack => {
      // Copy track and properties
      const next = { ...t, properties: { ...t.properties } } as AnimationTrack;

      const typePrefix = `${t.type}.`;
      const trackTypePrefix = `track.${t.identifier.id}.${t.type}.`;
      const trackScalarPrefix = `track.${t.identifier.id}.`;

      // 1) Apply type-level keys (affect all tracks of this type)
      for (const key of keys) {
        if (!key.startsWith(typePrefix)) continue;
        const subPath = key.slice(typePrefix.length);
        const val = reader(key);
        if (val === undefined) continue;
        if (
          subPath === "easing" &&
          (val === "linear" ||
            val === "easeInOut" ||
            val === "easeIn" ||
            val === "easeOut")
        ) {
          next.easing = val;
          continue;
        }
        if (subPath === "startTime" && typeof val === "number") {
          next.startTime = val;
          continue;
        }
        if (subPath === "duration" && typeof val === "number") {
          next.duration = val;
          continue;
        }
        setByPath(
          next.properties as unknown as Record<string, unknown>,
          subPath,
          val,
        );
      }

      // 2) Apply track-specific keys (override type-level)
      for (const key of keys) {
        if (key.startsWith(trackTypePrefix)) {
          const subPath = key.slice(trackTypePrefix.length);
          const val = reader(key);
          if (val === undefined) continue;
          if (
            subPath === "easing" &&
            (val === "linear" ||
              val === "easeInOut" ||
              val === "easeIn" ||
              val === "easeOut")
          ) {
            next.easing = val;
            continue;
          }
          if (subPath === "startTime" && typeof val === "number") {
            next.startTime = val;
            continue;
          }
          if (subPath === "duration" && typeof val === "number") {
            next.duration = val;
            continue;
          }
          setByPath(
            next.properties as unknown as Record<string, unknown>,
            subPath,
            val,
          );
          continue;
        }
        // Also support scalar track keys like track.<id>.duration, track.<id>.easing
        if (key.startsWith(trackScalarPrefix)) {
          const sub = key.slice(trackScalarPrefix.length);
          const val = reader(key);
          if (val === undefined) continue;
          if (
            sub === "easing" &&
            (val === "linear" ||
              val === "easeInOut" ||
              val === "easeIn" ||
              val === "easeOut")
          ) {
            next.easing = val;
            continue;
          }
          if (sub === "startTime" && typeof val === "number") {
            next.startTime = val;
            continue;
          }
          if (sub === "duration" && typeof val === "number") {
            next.duration = val;
            continue;
          }
        }
      }

      return next;
    };

    // First, apply global bindings once
    const resolvedTracks: AnimationTrack[] = originalTracks.map((t) =>
      applyBindingsToTrack(t, globalBindingKeys, readVarGlobal),
    );

    const allAnimations: SceneAnimationTrack[] = [];
    const passThoughObjects: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(
      inputs as unknown as ExecutionValue[],
    );
    const outputCursorMap: Record<string, number> = { ...upstreamCursorMap };
    const perObjectAnimations: Record<string, SceneAnimationTrack[]> =
      this.extractPerObjectAnimationsFromInputs(
        inputs as unknown as ExecutionValue[],
      );
    const upstreamAssignments: PerObjectAssignments | undefined =
      this.extractPerObjectAssignmentsFromInputs(
        inputs as unknown as ExecutionValue[],
      );

    // Read node-level assignments stored on the Animation node itself
    const nodeAssignments: PerObjectAssignments | undefined =
      data.perObjectAssignments as PerObjectAssignments | undefined;

    // Merge upstream + node-level; node-level takes precedence per object
    const mergedAssignments: PerObjectAssignments | undefined = (() => {
      if (!upstreamAssignments && !nodeAssignments) return undefined;
      const result: PerObjectAssignments = {};
      const objectIds = new Set<string>([
        ...Object.keys(upstreamAssignments ?? {}),
        ...Object.keys(nodeAssignments ?? {}),
      ]);
      for (const objectId of objectIds) {
        const base = upstreamAssignments?.[objectId];
        const overrides = nodeAssignments?.[objectId];
        const merged = mergeObjectAssignments(base, overrides);
        if (merged) result[objectId] = merged;
      }
      return result;
    })();

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const timedObject of inputData) {
        const objectId = (timedObject as { id?: unknown }).id as
          | string
          | undefined;
        const objectIdNoPrefix = objectId ? normalizeObjectId(String(objectId)) : "";
        const appearanceTime = (timedObject as { appearanceTime?: unknown })
          .appearanceTime as number | undefined;
        let baseline: number;
        if (
          typeof objectId === "string" &&
          upstreamCursorMap[objectId] !== undefined
        ) {
          baseline = upstreamCursorMap[objectId];
        } else {
          baseline = appearanceTime ?? 0;
        }
        // Only include prior animations from the current execution path
        const priorForObject = objectId
          ? (perObjectAnimations[objectId] ?? [])
          : [];

        // Apply per-object bindings if present
        const bindingLookupId = objectId
          ? resolveBindingLookupId(
              bindingsByObject as Record<string, unknown>,
              String(objectId),
            )
          : undefined;
        const objectBindingKeys = bindingLookupId
          ? getObjectBindingKeys(
              bindingsByObject as Record<string, Record<string, unknown>>,
              String(objectId),
            )
          : [];
        const objectReader = readVarForObject(bindingLookupId);
        const resolvedForObject = objectId
          ? resolvedTracks.map((t) =>
              applyBindingsToTrack(t, objectBindingKeys, objectReader),
            )
          : resolvedTracks;

        // Build a masked per-object assignment so bound keys take precedence over manual overrides
        const maskedAssignmentsForObject = (() => {
          if (!objectId) return undefined;
          const base = pickAssignmentsForObject(
            mergedAssignments,
            String(objectId),
          );
          if (!base) return undefined;
          // Only mask per-object bound keys; allow per-object manual overrides
          // to override any global bindings (matching Canvas behavior)
          const keys = objectBindingKeys;

          // FIX: Use proper typing with ObjectAssignments interface instead of any
          interface ObjectAssignments {
            initial?: Record<string, unknown>;
            tracks?: Array<{
              trackId?: string;
              type?: string;
              properties?: Record<string, unknown>;
              [key: string]: unknown;
            }>;
          }

          const next: ObjectAssignments = { ...base };
          const prunedTracks: Array<Record<string, unknown>> = [];
          const tracks = Array.isArray(base.tracks)
            ? (base.tracks as Array<Record<string, unknown>>).map((t) => ({
                ...t,
                properties: t.properties ? deepClone(t.properties) : undefined,
              }))
            : [];

          for (const t of tracks) {
            // Remove overrides for any bound keys that apply to this track
            for (const key of keys) {
              const trackId = (t as { trackId?: string }).trackId;
              if (!trackId) continue;
              const trackPrefix = `track.${trackId}.`;
              if (key.startsWith(trackPrefix)) {
                const sub = key.slice(trackPrefix.length);
                if (
                  sub === "duration" ||
                  sub === "startTime" ||
                  sub === "easing"
                ) {
                  delete (t as Record<string, unknown>)[sub];
                  continue;
                }
                const trackType = (t as { type?: string }).type;
                if (!trackType) continue;
                const typePrefix = `${trackType}.`;
                if (sub.startsWith(typePrefix)) {
                  const propPath = sub.slice(typePrefix.length);
                  if (
                    propPath === "duration" ||
                    propPath === "startTime" ||
                    propPath === "easing"
                  ) {
                    delete (t as Record<string, unknown>)[sub];
                  } else if (
                    (t as { properties?: Record<string, unknown> }).properties
                  ) {
                    deleteByPath(
                      (t as { properties: Record<string, unknown> }).properties,
                      propPath,
                    );
                  }
                }
                continue;
              }
              const trackType = (t as { type?: string }).type;
              if (!trackType) continue;
              const typePrefix = `${trackType}.`;
              if (key.startsWith(typePrefix)) {
                const subPath = key.slice(typePrefix.length);
                if (
                  subPath === "duration" ||
                  subPath === "startTime" ||
                  subPath === "easing"
                ) {
                  delete (t as Record<string, unknown>)[subPath];
                } else if (
                  (t as { properties?: Record<string, unknown> }).properties
                ) {
                  deleteByPath(
                    (t as { properties: Record<string, unknown> }).properties,
                    subPath,
                  );
                }
              }
            }
            const properties = (t as { properties?: Record<string, unknown> })
              .properties;
            const hasProps = properties && Object.keys(properties).length > 0;
            const tRecord = t as Record<string, unknown>;
            const hasMeta =
              tRecord.easing !== undefined ||
              tRecord.startTime !== undefined ||
              tRecord.duration !== undefined;
            if (hasProps || hasMeta)
              prunedTracks.push(t as Record<string, unknown>);
          }
          const nextRecord = next as Record<string, unknown>;
          if (prunedTracks.length > 0) nextRecord.tracks = prunedTracks;
          else delete nextRecord.tracks;
          return { [objectId]: next } as PerObjectAssignments;
        })();

        const animations = convertTracksToSceneAnimations(
          resolvedForObject,
          objectId ?? "",
          baseline,
          priorForObject,
          maskedAssignmentsForObject,
        );

        if (objectId) {
          perObjectAnimations[objectId] = [
            ...(perObjectAnimations[objectId] ?? []),
            ...animations,
          ];
        }

        allAnimations.push(...animations);
        passThoughObjects.push(timedObject);

        if (objectId) {
          const localEnd =
            animations.length > 0
              ? Math.max(...animations.map((a) => a.startTime + a.duration))
              : baseline;
          outputCursorMap[objectId] = Math.max(
            outputCursorMap[objectId] ?? 0,
            localEnd,
          );
        }
      }
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      passThoughObjects,
      {
        perObjectTimeCursor: outputCursorMap,
        perObjectAnimations: this.clonePerObjectAnimations(perObjectAnimations),
        perObjectAssignments: mergedAssignments,
      },
    );
  }

  private clonePerObjectAnimations(
    map: Record<string, SceneAnimationTrack[]>,
  ): Record<string, SceneAnimationTrack[]> {
    const cloned: Record<string, SceneAnimationTrack[]> = {};
    for (const [k, v] of Object.entries(map)) {
      cloned[k] = v.map((t) => ({
        ...t,
        properties: deepClone(t.properties),
      })) as SceneAnimationTrack[];
    }
    return cloned;
  }

  private extractPerObjectAnimationsFromInputs(
    inputs: ExecutionValue[],
  ): Record<string, SceneAnimationTrack[]> {
    const merged: Record<string, SceneAnimationTrack[]> = {};
    for (const input of inputs) {
      // FIX: Properly type the metadata instead of using any
      const perObj = (
        input.metadata as
          | { perObjectAnimations?: Record<string, SceneAnimationTrack[]> }
          | undefined
      )?.perObjectAnimations;
      if (!perObj) continue;
      for (const [objectId, tracks] of Object.entries(perObj)) {
        const list = merged[objectId] ?? [];
        merged[objectId] = [...list, ...tracks];
      }
    }
    return merged;
  }

  private extractCursorsFromInputs(
    inputs: ExecutionValue[],
  ): Record<string, number> {
    const maps: Record<string, number>[] = [];
    for (const input of inputs) {
      // FIX: Properly type the metadata instead of using any
      const cursors = (
        input.metadata as
          | { perObjectTimeCursor?: Record<string, number> }
          | undefined
      )?.perObjectTimeCursor;
      if (cursors) maps.push(cursors);
    }
    if (maps.length === 0) return {};
    return mergeCursorMaps(maps);
  }

  private extractPerObjectAssignmentsFromInputs(
    inputs: ExecutionValue[],
  ): PerObjectAssignments | undefined {
    const merged: PerObjectAssignments = {};
    let found = false;
    for (const input of inputs) {
      // FIX: Properly type the metadata instead of using any
      const fromMeta = (
        input.metadata as
          | { perObjectAssignments?: PerObjectAssignments }
          | undefined
      )?.perObjectAssignments;
      if (!fromMeta) continue;
      for (const input of inputs) {
        // FIX: Properly type the metadata instead of using any
        const fromMeta = (
          input.metadata as
            | { perObjectAssignments?: PerObjectAssignments }
            | undefined
        )?.perObjectAssignments;
        if (!fromMeta) continue;
        for (const [objectId, assignment] of Object.entries(fromMeta)) {
          found = true;
          const base = merged[objectId];
          const combined = mergeObjectAssignments(base, assignment);
          if (combined) merged[objectId] = combined;
        }
      }
    }
    return found ? merged : undefined;
  }

  private async executeTypography(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      "input",
    );

    logger.info(`Applying text styling: ${node.data.identifier.displayName}`);

    // Variable binding resolution (identical to Canvas pattern)
    const bindings =
      (data.variableBindings as
        | Record<string, { target?: string; boundResultNodeId?: string }>
        | undefined) ?? {};
    const bindingsByObject =
      (data.variableBindingsByObject as
        | Record<
            string,
            Record<string, { target?: string; boundResultNodeId?: string }>
          >
        | undefined) ?? {};

    const readVarGlobal = (key: string): unknown => {
      const rid = bindings[key]?.boundResultNodeId;
      if (!rid) return undefined;
      return (
        context.nodeOutputs.get(`${rid}.output`) ??
        context.nodeOutputs.get(`${rid}.result`)
      )?.data;
    };

    const readVarForObject =
      (objectId: string | undefined) =>
      (key: string): unknown => {
        if (!objectId) return readVarGlobal(key);
        const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
        if (rid)
          return (
            context.nodeOutputs.get(`${rid}.output`) ??
            context.nodeOutputs.get(`${rid}.result`)
          )?.data;
        return readVarGlobal(key);
      };

    // Build Typography overrides with ALL properties
    const baseOverrides: {
      content?: string;
      // Typography properties (KEEP)
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string;
      textAlign?: string;
      lineHeight?: number;
      letterSpacing?: number;
      // NEW PROPERTIES - Add these
      fontStyle?: string;
      textBaseline?: string;
      direction?: string;
      // RESTORE: Add these back
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
      // Text Effects (KEEP)
      shadowColor?: string;
      shadowOffsetX?: number;
      shadowOffsetY?: number;
      shadowBlur?: number;
      textOpacity?: number;
    } = {
      content: data.content as string,
      // Typography properties (KEEP)
      fontFamily: data.fontFamily as string,
      fontSize: data.fontSize as number,
      fontWeight: data.fontWeight as string,
      textAlign: data.textAlign as string,
      lineHeight: data.lineHeight as number,
      letterSpacing: data.letterSpacing as number,
      // NEW PROPERTIES - Add these
      fontStyle: data.fontStyle as string,
      textBaseline: data.textBaseline as string,
      direction: data.direction as string,
      // RESTORE: Add color assignments
      fillColor: data.fillColor as string,
      strokeColor: data.strokeColor as string,
      strokeWidth: data.strokeWidth as number,
      // Text Effects (KEEP)
      shadowColor: data.shadowColor as string,
      shadowOffsetX: data.shadowOffsetX as number,
      shadowOffsetY: data.shadowOffsetY as number,
      shadowBlur: data.shadowBlur as number,
      textOpacity: data.textOpacity as number,
    };

    // Apply all global binding keys generically into baseOverrides
    const globalKeys = Object.keys(bindings);
    const nodeOverrides = JSON.parse(
      JSON.stringify(baseOverrides),
    ) as typeof baseOverrides;
    for (const key of globalKeys) {
      const val = readVarGlobal(key);
      if (val === undefined) continue;

      // Type-safe property setting for ALL Typography overrides
      switch (key) {
        case "content": // ADD this case
          if (typeof val === "string") nodeOverrides.content = val;
          break;
        // EXISTING CASES (keep unchanged)
        case "fontFamily":
          if (typeof val === "string") nodeOverrides.fontFamily = val;
          break;
        case "fontSize":
          if (typeof val === "number") nodeOverrides.fontSize = val;
          break;
        case "fontWeight":
          if (typeof val === "string") nodeOverrides.fontWeight = val;
          break;
        case "textAlign":
          if (typeof val === "string") nodeOverrides.textAlign = val;
          break;
        case "lineHeight":
          if (typeof val === "number") nodeOverrides.lineHeight = val;
          break;
        case "letterSpacing":
          if (typeof val === "number") nodeOverrides.letterSpacing = val;
          break;
        // NEW CASES - Add these
        case "fontStyle":
          if (typeof val === "string") nodeOverrides.fontStyle = val;
          break;
        case "textBaseline":
          if (typeof val === "string") nodeOverrides.textBaseline = val;
          break;
        case "direction":
          if (typeof val === "string") nodeOverrides.direction = val;
          break;
        // RESTORE: Add color binding cases
        case "fillColor":
          if (typeof val === "string") nodeOverrides.fillColor = val;
          break;
        case "strokeColor":
          if (typeof val === "string") nodeOverrides.strokeColor = val;
          break;
        case "strokeWidth":
          if (typeof val === "number") nodeOverrides.strokeWidth = val;
          break;
        case "shadowColor":
          if (typeof val === "string") nodeOverrides.shadowColor = val;
          break;
        case "shadowOffsetX":
          if (typeof val === "number") nodeOverrides.shadowOffsetX = val;
          break;
        case "shadowOffsetY":
          if (typeof val === "number") nodeOverrides.shadowOffsetY = val;
          break;
        case "shadowBlur":
          if (typeof val === "number") nodeOverrides.shadowBlur = val;
          break;
        case "textOpacity":
          if (typeof val === "number") nodeOverrides.textOpacity = val;
          break;
      }
    }

    const processedObjects: unknown[] = [];

    // Read optional per-object assignments metadata (from upstream)
    const upstreamAssignments: PerObjectAssignments | undefined =
      this.extractPerObjectAssignmentsFromInputs(inputs);
    // Read node-level assignments stored on the Typography node itself
    const nodeAssignments: PerObjectAssignments | undefined =
      data.perObjectAssignments as PerObjectAssignments | undefined;

    // Merge upstream + node-level; node-level takes precedence per object
    const mergedAssignments: PerObjectAssignments | undefined = (() => {
      if (!upstreamAssignments && !nodeAssignments) return undefined;
      const result: PerObjectAssignments = {};
      const objectIds = new Set<string>([
        ...Object.keys(upstreamAssignments ?? {}),
        ...Object.keys(nodeAssignments ?? {}),
      ]);
      for (const objectId of objectIds) {
        const base = upstreamAssignments?.[objectId];
        const overrides = nodeAssignments?.[objectId];
        const merged = mergeObjectAssignments(base, overrides);
        if (merged) result[objectId] = merged;
      }
      return result;
    })();

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const obj of inputData) {
        if (this.isTextObject(obj)) {
          const processed = this.processTextObject(
            obj,
            nodeOverrides,
            mergedAssignments,
            bindingsByObject,
            readVarForObject,
          );
          processedObjects.push(processed);
        } else {
          // Pass through non-text objects unchanged
          processedObjects.push(obj);
        }
      }
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      processedObjects,
      {
        perObjectTimeCursor: this.extractCursorsFromInputs(inputs),
        perObjectAnimations: this.extractPerObjectAnimationsFromInputs(inputs),
        perObjectAssignments: mergedAssignments,
      },
    );

    logger.info(
      `Text styling applied: ${processedObjects.length} objects processed`,
    );
  }

  // Helper methods (follow Canvas implementation patterns)
  private isTextObject(obj: unknown): obj is SceneObject {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "type" in obj &&
      (obj as { type: string }).type === "text"
    );
  }

  private processTextObject(
    obj: SceneObject,
    nodeOverrides: {
      content?: string;
      // Typography properties (KEEP)
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string;
      textAlign?: string;
      lineHeight?: number;
      letterSpacing?: number;
      // NEW PROPERTIES - Add these
      fontStyle?: string;
      textBaseline?: string;
      direction?: string;
      // RESTORE: Add color cases back
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
      // Text Effects (KEEP)
      shadowColor?: string;
      shadowOffsetX?: number;
      shadowOffsetY?: number;
      shadowBlur?: number;
      textOpacity?: number;
    },
    assignments: PerObjectAssignments | undefined,
    bindingsByObject: Record<
      string,
      Record<string, { target?: string; boundResultNodeId?: string }>
    >,
    readVarForObject: (
      objectId: string | undefined,
    ) => (key: string) => unknown,
  ): SceneObject {
    const objectId = obj.id;
    const bindingLookupId = resolveBindingLookupId(
      bindingsByObject as Record<string, unknown>,
      String(objectId),
    );
    const reader = readVarForObject(bindingLookupId);

    // Build object-specific overrides
    const objectOverrides = { ...nodeOverrides };
    const objectKeys = getObjectBindingKeys(
      bindingsByObject as Record<string, Record<string, unknown>>,
      String(objectId),
    );

    for (const key of objectKeys) {
      const value = reader(key);
      if (value !== undefined) {
        switch (key) {
          case "content":
            if (typeof value === "string") objectOverrides.content = value;
            break;
          // EXISTING CASES (keep unchanged)
          case "fontFamily":
            if (typeof value === "string") objectOverrides.fontFamily = value;
            break;
          case "fontSize":
            if (typeof value === "number") objectOverrides.fontSize = value;
            break;
          case "fontWeight":
            if (typeof value === "string") objectOverrides.fontWeight = value;
            break;
          case "textAlign":
            if (typeof value === "string") objectOverrides.textAlign = value;
            break;
          case "lineHeight":
            if (typeof value === "number") objectOverrides.lineHeight = value;
            break;
          case "letterSpacing":
            if (typeof value === "number")
              objectOverrides.letterSpacing = value;
            break;
          // NEW CASES - Add these
          case "fontStyle":
            if (typeof value === "string") objectOverrides.fontStyle = value;
            break;
          case "textBaseline":
            if (typeof value === "string") objectOverrides.textBaseline = value;
            break;
          case "direction":
            if (typeof value === "string") objectOverrides.direction = value;
            break;
          // RESTORE: Add color cases back
          case "fillColor":
            if (typeof value === "string") objectOverrides.fillColor = value;
            break;
          case "strokeColor":
            if (typeof value === "string") objectOverrides.strokeColor = value;
            break;
          case "strokeWidth":
            if (typeof value === "number") objectOverrides.strokeWidth = value;
            break;
          case "shadowColor":
            if (typeof value === "string") objectOverrides.shadowColor = value;
            break;
          case "shadowOffsetX":
            if (typeof value === "number")
              objectOverrides.shadowOffsetX = value;
            break;
          case "shadowOffsetY":
            if (typeof value === "number")
              objectOverrides.shadowOffsetY = value;
            break;
          case "shadowBlur":
            if (typeof value === "number") objectOverrides.shadowBlur = value;
            break;
          case "textOpacity":
            if (typeof value === "number") objectOverrides.textOpacity = value;
            break;
        }
      }
    }

    // Apply per-object assignments (masking bound properties)
    const assignmentsForObject = pickAssignmentsForObject(
      assignments,
      String(objectId),
    );
    const maskedAssignmentsForObject = (() => {
      if (!assignmentsForObject) return undefined;
      const keys = objectKeys; // Only use per-object bindings
      const next: ObjectAssignments = { ...assignmentsForObject };
      const initial = { ...(next.initial ?? {}) } as Record<string, unknown>;

      // Remove properties that are bound by variables
      for (const key of keys) {
        switch (key) {
          case "content":
            delete initial.content;
            break; // ADD this case
          case "fontFamily":
            delete initial.fontFamily;
            break;
          case "fontWeight":
            delete initial.fontWeight;
            break;
          case "textAlign":
            delete initial.textAlign;
            break;
          case "lineHeight":
            delete initial.lineHeight;
            break;
          case "letterSpacing":
            delete initial.letterSpacing;
            break;
          // NEW CASES - Add these
          case "fontStyle":
            delete initial.fontStyle;
            break;
          case "textBaseline":
            delete initial.textBaseline;
            break;
          case "direction":
            delete initial.direction;
            break;
          // RESTORE: Add color cases back
          case "fillColor":
            delete initial.fillColor;
            break;
          case "strokeColor":
            delete initial.strokeColor;
            break;
          case "strokeWidth":
            delete initial.strokeWidth;
            break;
          case "shadowColor":
            delete initial.shadowColor;
            break;
          case "shadowOffsetX":
            delete initial.shadowOffsetX;
            break;
          case "shadowOffsetY":
            delete initial.shadowOffsetY;
            break;
          case "shadowBlur":
            delete initial.shadowBlur;
            break;
          case "textOpacity":
            delete initial.textOpacity;
            break;
          default:
            break;
        }
      }

      // Prune empty objects recursively
      const prunedInitial = (() => {
        const obj = JSON.parse(JSON.stringify(initial)) as Record<
          string,
          unknown
        >;
        const prune = (o: Record<string, unknown>): Record<string, unknown> => {
          for (const k of Object.keys(o)) {
            if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) {
              o[k] = prune(o[k] as Record<string, unknown>);
              if (Object.keys(o[k] as Record<string, unknown>).length === 0) {
                delete o[k];
              }
            }
          }
          return o;
        };
        return prune(obj);
      })();

      if (Object.keys(prunedInitial).length > 0) {
        next.initial = prunedInitial;
      } else {
        delete next.initial;
      }
      return next;
    })();

    // Apply text styling from assignments
    const finalTypography = {
      content:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.content as string) ?? objectOverrides.content, // ADD this line
      fontFamily:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.fontFamily as string) ?? objectOverrides.fontFamily,
      fontSize:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.fontSize as number) ?? objectOverrides.fontSize,
      fontWeight:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.fontWeight as string) ?? objectOverrides.fontWeight,
      textAlign:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.textAlign as string) ?? objectOverrides.textAlign,
      lineHeight:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.lineHeight as number) ?? objectOverrides.lineHeight,
      letterSpacing:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.letterSpacing as number) ?? objectOverrides.letterSpacing,
      fontStyle:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.fontStyle as string) ?? objectOverrides.fontStyle,
      textBaseline:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.textBaseline as string) ?? objectOverrides.textBaseline,
      direction:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.direction as string) ?? objectOverrides.direction,
      // RESTORE: Add color cases back
      fillColor:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.fillColor as string) ?? objectOverrides.fillColor,
      strokeColor:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.strokeColor as string) ?? objectOverrides.strokeColor,
      strokeWidth:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.strokeWidth as number) ?? objectOverrides.strokeWidth,
      shadowColor:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.shadowColor as string) ?? objectOverrides.shadowColor,
      shadowOffsetX:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.shadowOffsetX as number) ?? objectOverrides.shadowOffsetX,
      shadowOffsetY:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.shadowOffsetY as number) ?? objectOverrides.shadowOffsetY,
      shadowBlur:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.shadowBlur as number) ?? objectOverrides.shadowBlur,
      textOpacity:
        ((maskedAssignmentsForObject?.initial as Record<string, unknown>)
          ?.textOpacity as number) ?? objectOverrides.textOpacity,
    };

    // CRITICAL: Update both properties.content AND typography.content
    // This ensures content changes are reflected in the rendered output
    return {
      ...obj,
      properties: {
        ...obj.properties,
        content:
          finalTypography.content ?? (obj.properties as TextProperties).content, // Override text content
      },
      typography: finalTypography,
    };
  }

  private mergeAssignments(
    upstream: PerObjectAssignments | undefined,
    node: PerObjectAssignments | undefined,
  ): PerObjectAssignments | undefined {
    if (!upstream && !node) return undefined;

    const result: PerObjectAssignments = {};
    const objectIds = new Set<string>([
      ...Object.keys(upstream ?? {}),
      ...Object.keys(node ?? {}),
    ]);

    for (const objectId of objectIds) {
      const base = upstream?.[objectId];
      const overrides = node?.[objectId];
      const merged = mergeObjectAssignments(base, overrides);
      if (merged) result[objectId] = merged;
    }

    return result;
  }
}
