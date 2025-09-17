import type { ReactFlowNode, ReactFlowEdge } from '../../types/graph';
import { setNodeOutput, getConnectedInputs, type ExecutionContext } from '../../execution-context';
import type { NodeData, AnimationTrack } from '@/shared/types';
import type { SceneAnimationTrack } from '@/shared/types';
import type { PerObjectAssignments } from '@/shared/properties/assignments';
import { mergeObjectAssignments } from '@/shared/properties/assignments';
import {
  resolveBindingLookupId,
  getObjectBindingKeys,
  pickAssignmentsForObject,
} from '@/shared/properties/override-utils';
import { convertTracksToSceneAnimations } from '../../scene/scene-assembler';
import { setByPath, deleteByPath } from '@/shared/utils/object-path';
import { resolveFieldValue, type BatchResolveContext } from '../../scene/batch-overrides-resolver';
import {
  extractCursorsFromInputs,
  extractPerObjectAnimationsFromInputs,
  extractPerObjectAssignmentsFromInputs,
  extractPerObjectBatchOverridesFromInputs,
  clonePerObjectAnimations,
} from '../shared/per-object-helpers';
import { deepClone, numberCoerce, stringCoerce } from '../shared/common';

export async function executeAnimationNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[]
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
    'input'
  );

  // Resolve variable bindings from upstream Result nodes
  const bindings =
    (data.variableBindings as
      | Record<string, { target?: string; boundResultNodeId?: string }>
      | undefined) ?? {};
  const bindingsByObject =
    (data.variableBindingsByObject as
      | Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>
      | undefined) ?? {};
  const readVarGlobal = (key: string): unknown => {
    const rid = bindings[key]?.boundResultNodeId;
    if (!rid) return undefined;
    const val = (
      context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`)
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
          context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`)
        )?.data;
      return readVarGlobal(key);
    };

  // Resolve duration binding if present (global only)
  const boundDuration = readVarGlobal('duration');
  if (typeof boundDuration === 'number') {
    data.duration = boundDuration;
  }

  // Build a list of binding keys to apply at global level
  const globalBindingKeys = Object.keys(bindings);

  // Clone tracks and apply generic per-track bindings using key prefixes
  const originalTracks: AnimationTrack[] = (data.tracks as AnimationTrack[]) || [];

  const applyBindingsToTrack = (
    t: AnimationTrack,
    keys: string[],
    reader: (k: string) => unknown
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
        subPath === 'easing' &&
        (val === 'linear' || val === 'easeInOut' || val === 'easeIn' || val === 'easeOut')
      ) {
        next.easing = val;
        continue;
      }
      if (subPath === 'startTime' && typeof val === 'number') {
        next.startTime = val;
        continue;
      }
      if (subPath === 'duration' && typeof val === 'number') {
        next.duration = val;
        continue;
      }
      setByPath(next.properties as unknown as Record<string, unknown>, subPath, val);
    }

    // 2) Apply track-specific keys (override type-level)
    for (const key of keys) {
      if (key.startsWith(trackTypePrefix)) {
        const subPath = key.slice(trackTypePrefix.length);
        const val = reader(key);
        if (val === undefined) continue;
        if (
          subPath === 'easing' &&
          (val === 'linear' || val === 'easeInOut' || val === 'easeIn' || val === 'easeOut')
        ) {
          next.easing = val;
          continue;
        }
        if (subPath === 'startTime' && typeof val === 'number') {
          next.startTime = val;
          continue;
        }
        if (subPath === 'duration' && typeof val === 'number') {
          next.duration = val;
          continue;
        }
        setByPath(next.properties as unknown as Record<string, unknown>, subPath, val);
        continue;
      }
      // Also support scalar track keys like track.<id>.duration, track.<id>.easing
      if (key.startsWith(trackScalarPrefix)) {
        const sub = key.slice(trackScalarPrefix.length);
        const val = reader(key);
        if (val === undefined) continue;
        if (
          sub === 'easing' &&
          (val === 'linear' || val === 'easeInOut' || val === 'easeIn' || val === 'easeOut')
        ) {
          next.easing = val;
          continue;
        }
        if (sub === 'startTime' && typeof val === 'number') {
          next.startTime = val;
          continue;
        }
        if (sub === 'duration' && typeof val === 'number') {
          next.duration = val;
          continue;
        }
      }
    }

    return next;
  };

  // First, apply global bindings once
  const resolvedTracks: AnimationTrack[] = originalTracks.map((t) =>
    applyBindingsToTrack(t, globalBindingKeys, readVarGlobal)
  );

  const allAnimations: SceneAnimationTrack[] = [];
  const passThroughObjects: unknown[] = [];
  const upstreamCursorMap = extractCursorsFromInputs(inputs);
  const outputCursorMap: Record<string, number> = { ...upstreamCursorMap };
  const perObjectAnimations: Record<string, SceneAnimationTrack[]> =
    extractPerObjectAnimationsFromInputs(inputs);
  const upstreamAssignments: PerObjectAssignments | undefined =
    extractPerObjectAssignmentsFromInputs(inputs);

  // Read node-level assignments stored on the Animation node itself
  const nodeAssignments: PerObjectAssignments | undefined = data.perObjectAssignments as
    | PerObjectAssignments
    | undefined;

  // Extract perObjectBatchOverrides from inputs
  const upstreamBatchOverrides:
    | Record<string, Record<string, Record<string, unknown>>>
    | undefined = extractPerObjectBatchOverridesFromInputs(inputs);

  // Scope node-level perObjectBatchOverrides (Timeline editor) to this node's connected objects
  const scopedNodeBatchOverrides:
    | Record<string, Record<string, Record<string, unknown>>>
    | undefined = (() => {
    const batchOverridesByField = (
      data as {
        batchOverridesByField?: Record<string, Record<string, Record<string, unknown>>>;
      }
    ).batchOverridesByField;
    if (!batchOverridesByField) return undefined;

    // Collect objects connected to this node from inputs
    const passedIds = new Set<string>();
    const objectsById = new Map<string, unknown>();
    for (const inp of inputs) {
      const arr = Array.isArray(inp.data) ? inp.data : [inp.data];
      for (const obj of arr) {
        const oid = (obj as { id?: unknown }).id;
        if (typeof oid === 'string' && oid) {
          passedIds.add(oid);
          objectsById.set(oid, obj);
        }
      }
    }

    // Helper: restrict defaults to batched objects (consistent with Canvas/Media/Typography)
    const isBatched = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      const record = obj as { batch?: unknown; batchKeys?: unknown };
      if (record.batch !== true) return false;
      const keys = Array.isArray(record.batchKeys)
        ? (record.batchKeys as unknown[]).filter(
            (key): key is string => typeof key === 'string' && key.trim() !== ''
          )
        : [];
      return keys.length > 0;
    };

    const DEFAULT_MARKER = '__default_object__';
    const out: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const [fieldPath, byObject] of Object.entries(batchOverridesByField)) {
      for (const [rawObjId, byKey] of Object.entries(byObject)) {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(byKey)) {
          const key = String(k).trim();
          if (!key) continue;
          cleaned[key] = v;
        }
        if (rawObjId === DEFAULT_MARKER) {
          // Expand defaults to only this node's connected objects (batched only)
          for (const [oid, obj] of objectsById) {
            if (!passedIds.has(oid)) continue;
            if (!isBatched(obj)) continue;
            out[oid] ??= {};
            out[oid][fieldPath] = {
              ...(out[oid][fieldPath] ?? {}),
              ...cleaned,
            };
          }
        } else if (passedIds.has(rawObjId)) {
          out[rawObjId] ??= {};
          out[rawObjId][fieldPath] = {
            ...(out[rawObjId][fieldPath] ?? {}),
            ...cleaned,
          };
        }
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  })();

  // Merge upstream + node-level batch overrides; node-level takes precedence per object
  const mergedBatchOverrides: Record<string, Record<string, Record<string, unknown>>> | undefined =
    (() => {
      if (!upstreamBatchOverrides && !scopedNodeBatchOverrides) return upstreamBatchOverrides;
      const result: Record<string, Record<string, Record<string, unknown>>> = {
        ...upstreamBatchOverrides,
      };
      if (scopedNodeBatchOverrides) {
        for (const [objectId, fieldOverrides] of Object.entries(scopedNodeBatchOverrides)) {
          result[objectId] = { ...result[objectId], ...fieldOverrides };
        }
      }
      return result;
    })();

  // Extract bound fields for Timeline batch overrides (following Typography pattern)
  const mergedBoundFields: Record<string, string[]> | undefined = (() => {
    const result: Record<string, string[]> = {};
    const globalBoundKeysTimeline = Object.keys(bindings);

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const timedObject of inputData) {
        const objectId = (timedObject as { id?: unknown }).id as string | undefined;
        if (objectId) {
          const objectKeys = Object.keys(bindingsByObject[objectId] ?? {});

          // Filter for Timeline-specific bound keys
          const timelineKeys = [...globalBoundKeysTimeline, ...objectKeys].filter(
            (key) => key.startsWith('Timeline.') || key.includes('track.')
          );

          if (timelineKeys.length > 0) {
            const existing = result[objectId] ?? [];
            result[objectId] = Array.from(new Set([...existing, ...timelineKeys.map(String)]));
          }
        }
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  })();

  // Get fallback metadata from first input for non-batch-override fields
  const firstInputMeta = inputs[0]?.metadata as
    | {
        perObjectBatchOverrides?: Record<string, Record<string, Record<string, unknown>>>;
        perObjectAnimations?: Record<string, SceneAnimationTrack[]>;
        perObjectAssignments?: PerObjectAssignments;
        perObjectBoundFields?: Record<string, string[]>;
      }
    | undefined;

  // Merge upstream + node-level assignments; node-level takes precedence per object
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
      const objectId = (timedObject as { id?: unknown }).id as string | undefined;
      // Removed unused objectIdNoPrefix variable
      const appearanceTime = (timedObject as { appearanceTime?: unknown }).appearanceTime as
        | number
        | undefined;
      // Appearance time is ALWAYS the foundation baseline for all animations
      let baseline: number = appearanceTime ?? 0;

      // Cursor map should only extend timing for continuing animations within the same path
      // but NEVER override the appearance time - animations can never start before object appears
      if (typeof objectId === 'string' && upstreamCursorMap[objectId] !== undefined) {
        // Only use cursor position if it's LATER than appearance time (continuing animations)
        baseline = Math.max(baseline, upstreamCursorMap[objectId]);
      }
      // Only include prior animations from the current execution path
      const priorForObject = objectId ? (perObjectAnimations[objectId] ?? []) : [];

      // Apply per-object bindings if present
      const bindingLookupId = objectId
        ? resolveBindingLookupId(bindingsByObject as Record<string, unknown>, String(objectId))
        : undefined;
      const objectBindingKeys = bindingLookupId
        ? getObjectBindingKeys(
            bindingsByObject as Record<string, Record<string, unknown>>,
            String(objectId)
          )
        : [];
      const objectReader = readVarForObject(bindingLookupId);
      const resolvedForObject = objectId
        ? resolvedTracks.map((t) => applyBindingsToTrack(t, objectBindingKeys, objectReader))
        : resolvedTracks;

      // Build a masked per-object assignment so bound keys take precedence over manual overrides
      const maskedAssignmentsForObject = (() => {
        if (!objectId) return undefined;
        const base = pickAssignmentsForObject(mergedAssignments, String(objectId));
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
              if (sub === 'duration' || sub === 'startTime' || sub === 'easing') {
                delete (t as Record<string, unknown>)[sub];
                continue;
              }
              const trackType = (t as { type?: string }).type;
              if (!trackType) continue;
              const typePrefix = `${trackType}.`;
              if (sub.startsWith(typePrefix)) {
                const propPath = sub.slice(typePrefix.length);
                if (propPath === 'duration' || propPath === 'startTime' || propPath === 'easing') {
                  delete (t as Record<string, unknown>)[sub];
                } else if ((t as { properties?: Record<string, unknown> }).properties) {
                  deleteByPath((t as { properties: Record<string, unknown> }).properties, propPath);
                }
              }
              continue;
            }
            const trackType = (t as { type?: string }).type;
            if (!trackType) continue;
            const typePrefix = `${trackType}.`;
            if (key.startsWith(typePrefix)) {
              const subPath = key.slice(typePrefix.length);
              if (subPath === 'duration' || subPath === 'startTime' || subPath === 'easing') {
                delete (t as Record<string, unknown>)[subPath];
              } else if ((t as { properties?: Record<string, unknown> }).properties) {
                deleteByPath((t as { properties: Record<string, unknown> }).properties, subPath);
              }
            }
          }
          const properties = (t as { properties?: Record<string, unknown> }).properties;
          const hasProps = properties && Object.keys(properties).length > 0;
          const tRecord = t as Record<string, unknown>;
          const hasMeta =
            tRecord.easing !== undefined ||
            tRecord.startTime !== undefined ||
            tRecord.duration !== undefined;
          if (hasProps || hasMeta) prunedTracks.push(t as Record<string, unknown>);
        }
        const nextRecord = next as Record<string, unknown>;
        if (prunedTracks.length > 0) nextRecord.tracks = prunedTracks;
        else delete nextRecord.tracks;
        return { [objectId]: next } as PerObjectAssignments;
      })();

      // Apply Timeline batch overrides to tracks before converting to scene animations
      const batchOverrideAppliedTracks = objectId
        ? applyTimelineBatchOverridesToTracks(
            resolvedForObject,
            objectId,
            mergedBatchOverrides,
            mergedBoundFields,
            // Batch key resolution will happen at scene partition level
            null
          )
        : resolvedForObject;

      const animations = convertTracksToSceneAnimations(
        batchOverrideAppliedTracks,
        objectId ?? '',
        baseline,
        priorForObject,
        maskedAssignmentsForObject
      );

      if (objectId) {
        perObjectAnimations[objectId] = [...(perObjectAnimations[objectId] ?? []), ...animations];
      }

      allAnimations.push(...animations);
      passThroughObjects.push(timedObject);

      if (objectId) {
        const localEnd =
          animations.length > 0
            ? Math.max(...animations.map((a) => a.startTime + a.duration))
            : baseline;
        outputCursorMap[objectId] = Math.max(outputCursorMap[objectId] ?? 0, localEnd);
      }
    }
  }

  setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', passThroughObjects, {
    perObjectTimeCursor: outputCursorMap,
    perObjectAnimations:
      clonePerObjectAnimations(perObjectAnimations) ?? firstInputMeta?.perObjectAnimations,
    perObjectAssignments: mergedAssignments ?? firstInputMeta?.perObjectAssignments,
    perObjectBatchOverrides: mergedBatchOverrides ?? firstInputMeta?.perObjectBatchOverrides,
    perObjectBoundFields: mergedBoundFields ?? firstInputMeta?.perObjectBoundFields,
  });
}

/**
 * Apply Timeline-specific batch overrides to animation tracks.
 * Follows the same pattern as Canvas/Typography batch override application.
 */
function applyTimelineBatchOverridesToTracks(
  tracks: AnimationTrack[],
  objectId: string,
  batchOverrides?: Record<string, Record<string, Record<string, unknown>>>,
  boundFields?: Record<string, string[]>,
  batchKey?: string | null
): AnimationTrack[] {
  if (!batchOverrides?.[objectId]) return tracks;

  const ctx: BatchResolveContext = {
    batchKey: batchKey ?? null,
    perObjectBatchOverrides: batchOverrides,
    perObjectBoundFields: boundFields,
  };

  return tracks.map((track) => {
    const properties = track.properties as unknown as Record<string, unknown>;
    const updatedProperties = { ...properties };

    // Apply Timeline batch overrides per track type
    switch (track.type) {
      case 'move': {
        const moveProps = updatedProperties as {
          from?: { x: number; y: number };
          to?: { x: number; y: number };
        };

        if (moveProps.from) {
          moveProps.from.x = resolveFieldValue(
            objectId,
            'Timeline.move.from.x',
            moveProps.from.x,
            ctx,
            numberCoerce
          );
          moveProps.from.y = resolveFieldValue(
            objectId,
            'Timeline.move.from.y',
            moveProps.from.y,
            ctx,
            numberCoerce
          );
        }

        if (moveProps.to) {
          moveProps.to.x = resolveFieldValue(
            objectId,
            'Timeline.move.to.x',
            moveProps.to.x,
            ctx,
            numberCoerce
          );
          moveProps.to.y = resolveFieldValue(
            objectId,
            'Timeline.move.to.y',
            moveProps.to.y,
            ctx,
            numberCoerce
          );
        }
        break;
      }

      case 'rotate': {
        const rotateProps = updatedProperties as {
          from?: number;
          to?: number;
        };
        if (typeof rotateProps.from === 'number') {
          rotateProps.from = resolveFieldValue(
            objectId,
            'Timeline.rotate.from',
            rotateProps.from,
            ctx,
            numberCoerce
          );
        }
        if (typeof rotateProps.to === 'number') {
          rotateProps.to = resolveFieldValue(
            objectId,
            'Timeline.rotate.to',
            rotateProps.to,
            ctx,
            numberCoerce
          );
        }
        break;
      }

      case 'scale': {
        const scaleProps = updatedProperties as {
          from?: { x?: number; y?: number } | number;
          to?: { x?: number; y?: number } | number;
        };
        // Normalize to object form then resolve per-axis
        if (scaleProps.from !== undefined) {
          const fromObj =
            typeof scaleProps.from === 'number'
              ? { x: scaleProps.from, y: scaleProps.from }
              : (scaleProps.from ?? {});
          const x = resolveFieldValue(
            objectId,
            'Timeline.scale.from.x',
            fromObj.x ?? 1,
            ctx,
            numberCoerce
          );
          const y = resolveFieldValue(
            objectId,
            'Timeline.scale.from.y',
            fromObj.y ?? 1,
            ctx,
            numberCoerce
          );
          scaleProps.from = { x, y } as unknown as Record<string, unknown>;
        }
        if (scaleProps.to !== undefined) {
          const toObj =
            typeof scaleProps.to === 'number'
              ? { x: scaleProps.to, y: scaleProps.to }
              : (scaleProps.to ?? {});
          const x = resolveFieldValue(
            objectId,
            'Timeline.scale.to.x',
            toObj.x ?? 1,
            ctx,
            numberCoerce
          );
          const y = resolveFieldValue(
            objectId,
            'Timeline.scale.to.y',
            toObj.y ?? 1,
            ctx,
            numberCoerce
          );
          scaleProps.to = { x, y } as unknown as Record<string, unknown>;
        }
        break;
      }

      case 'fade': {
        const fadeProps = updatedProperties as { from?: number; to?: number };
        if (typeof fadeProps.from === 'number') {
          fadeProps.from = resolveFieldValue(
            objectId,
            'Timeline.fade.from',
            fadeProps.from,
            ctx,
            numberCoerce
          );
        }
        if (typeof fadeProps.to === 'number') {
          fadeProps.to = resolveFieldValue(
            objectId,
            'Timeline.fade.to',
            fadeProps.to,
            ctx,
            numberCoerce
          );
        }
        break;
      }

      case 'color': {
        const colorProps = updatedProperties as {
          from?: string;
          to?: string;
          property?: string;
        };
        if (typeof colorProps.from === 'string') {
          colorProps.from = resolveFieldValue(
            objectId,
            'Timeline.color.from',
            colorProps.from,
            ctx,
            stringCoerce
          );
        }
        if (typeof colorProps.to === 'string') {
          colorProps.to = resolveFieldValue(
            objectId,
            'Timeline.color.to',
            colorProps.to,
            ctx,
            stringCoerce
          );
        }
        break;
      }
    }

    return {
      ...track,
      properties: updatedProperties as unknown,
    } as AnimationTrack;
  });
}
