import type { ReactFlowNode, ReactFlowEdge } from '../../types/graph';
import { setNodeOutput, getConnectedInputs, type ExecutionContext } from '../../execution-context';
import type { NodeData } from '@/shared/types';
import type { SceneObject } from '@/shared/types/scene';
import type { PerObjectAssignments } from '@/shared/properties/assignments';
import { mergeObjectAssignments } from '@/shared/properties/assignments';
import {
  resolveBindingLookupId,
  getObjectBindingKeys,
  pickAssignmentsForObject,
  mergePerObjectAssignments,
} from '@/shared/properties/override-utils';
import { resolveInitialObject } from '@/shared/properties/resolver';
import { logger } from '@/lib/logger';
import {
  extractCursorsFromInputs,
  extractPerObjectAssignmentsFromInputs,
  extractPerObjectBatchOverridesFromInputs,
  extractPerObjectAnimationsFromInputs,
} from '../shared/per-object-helpers';
const MEDIA_FIELD_KEYS = new Set([
  'imageAssetId',
  'cropX',
  'cropY',
  'cropWidth',
  'cropHeight',
  'displayWidth',
  'displayHeight',
]);

const toMediaFieldPath = (key: string): string =>
  key.startsWith('Media.') ? key : MEDIA_FIELD_KEYS.has(key) ? `Media.${key}` : key;

interface MediaOverrides {
  imageAssetId?: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  displayWidth?: number;
  displayHeight?: number;
  position?: { x: number; y: number };
  rotation?: number;
  scale?: { x: number; y: number };
  opacity?: number;
}

export async function executeMediaNode(
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

  logger.info(`Applying media processing: ${node.data.identifier.displayName}`);

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
    return (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))
      ?.data;
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

  const baseOverrides: MediaOverrides = {
    imageAssetId: data.imageAssetId as string,
    cropX: data.cropX as number,
    cropY: data.cropY as number,
    cropWidth: data.cropWidth as number,
    cropHeight: data.cropHeight as number,
    displayWidth: data.displayWidth as number,
    displayHeight: data.displayHeight as number,
  };

  const globalKeys = Object.keys(bindings);
  const nodeOverrides = JSON.parse(JSON.stringify(baseOverrides)) as MediaOverrides;

  for (const key of globalKeys) {
    const val = readVarGlobal(key);
    if (val === undefined) continue;

    switch (key) {
      case 'imageAssetId':
        if (typeof val === 'string') nodeOverrides.imageAssetId = val;
        break;
      case 'cropX':
        if (typeof val === 'number') nodeOverrides.cropX = val;
        break;
      case 'cropY':
        if (typeof val === 'number') nodeOverrides.cropY = val;
        break;
      case 'cropWidth':
        if (typeof val === 'number') nodeOverrides.cropWidth = val;
        break;
      case 'cropHeight':
        if (typeof val === 'number') nodeOverrides.cropHeight = val;
        break;
      case 'displayWidth':
        if (typeof val === 'number') nodeOverrides.displayWidth = val;
        break;
      case 'displayHeight':
        if (typeof val === 'number') nodeOverrides.displayHeight = val;
        break;
    }
  }

  const processedObjects: unknown[] = [];

  const upstreamAssignments = extractPerObjectAssignmentsFromInputs(inputs);
  const nodeAssignments = data.perObjectAssignments as PerObjectAssignments | undefined;
  const mergedAssignments = mergePerObjectAssignments(
    upstreamAssignments,
    nodeAssignments,
    mergeObjectAssignments
  );

  for (const input of inputs) {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];

    for (const obj of inputData) {
      if (isImageObject(obj)) {
        const processed = await processImageObject(
          obj,
          nodeOverrides,
          mergedAssignments,
          bindingsByObject ?? {},
          readVarForObject,
          context
        );
        processedObjects.push(processed);
      } else {
        processedObjects.push(obj);
      }
    }
  }

  type AssignmentWithBatchOverrides = {
    batchOverrides?: Record<string, Record<string, unknown>>;
  };

  const assignmentBatchOverrides = (() => {
    if (!mergedAssignments) return {};
    const scoped: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const [objectId, assignment] of Object.entries(mergedAssignments)) {
      if (!assignment || typeof assignment !== 'object') continue;
      const batchOverrides = (assignment as AssignmentWithBatchOverrides).batchOverrides;
      if (!batchOverrides || typeof batchOverrides !== 'object') continue;
      for (const [fieldPath, overrides] of Object.entries(batchOverrides)) {
        const destForField = scoped[objectId]?.[fieldPath] ?? {};
        scoped[objectId] = {
          ...scoped[objectId],
          [fieldPath]: { ...destForField, ...overrides },
        };
      }
    }
    return scoped;
  })();

  const batchOverridesByField =
    (
      data as unknown as {
        batchOverridesByField?: Record<string, Record<string, Record<string, unknown>>>;
      }
    ).batchOverridesByField ?? {};

  const processedImageObjects = processedObjects.filter((obj): obj is SceneObject =>
    isImageObject(obj)
  );

  const nodeBatchOverrides = (() => {
    if (Object.keys(batchOverridesByField).length === 0) return {};
    const defaultMarker = '__default_object__';
    const scoped: Record<string, Record<string, Record<string, unknown>>> = {};
    const objectMeta = processedImageObjects
      .map((obj) => ({
        id: obj.id,
        isBatched:
          Boolean(obj.batch) &&
          Array.isArray(obj.batchKeys) &&
          obj.batchKeys.some((k) => typeof k === 'string' && k.trim() !== ''),
      }))
      .filter(
        (entry): entry is { id: string; isBatched: boolean } =>
          typeof entry.id === 'string' && entry.id.length > 0
      );

    const objectsById = new Map(objectMeta.map((entry) => [entry.id, entry]));

    for (const [rawFieldPath, byObject] of Object.entries(batchOverridesByField)) {
      const fieldPath = toMediaFieldPath(rawFieldPath);
      for (const [rawObjId, byKey] of Object.entries(byObject)) {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(byKey)) {
          const key = String(k).trim();
          if (!key) continue;
          cleaned[key] = v;
        }
        if (Object.keys(cleaned).length === 0) continue;

        if (rawObjId === defaultMarker) {
          for (const { id, isBatched } of objectsById.values()) {
            if (!isBatched) continue;
            scoped[id] ??= {};
            scoped[id][fieldPath] = {
              ...(scoped[id][fieldPath] ?? {}),
              ...cleaned,
            };
          }
        } else if (objectsById.has(rawObjId)) {
          scoped[rawObjId] ??= {};
          scoped[rawObjId][fieldPath] = {
            ...(scoped[rawObjId][fieldPath] ?? {}),
            ...cleaned,
          };
        }
      }
    }

    return scoped;
  })();

  const mergeOverrideMaps = (
    sources: Array<Record<string, Record<string, Record<string, unknown>>> | undefined>
  ) => {
    const result: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const source of sources) {
      if (!source) continue;
      for (const [objectId, fields] of Object.entries(source)) {
        const destFields = result[objectId] ?? {};
        for (const [fieldPath, byKey] of Object.entries(fields)) {
          destFields[fieldPath] = {
            ...(destFields[fieldPath] ?? {}),
            ...byKey,
          };
        }
        result[objectId] = destFields;
      }
    }
    return result;
  };

  const emittedPerObjectBatchOverrides = (() => {
    const combined = mergeOverrideMaps([assignmentBatchOverrides, nodeBatchOverrides]);
    return Object.keys(combined).length > 0 ? combined : undefined;
  })();

  const perObjectBoundFields: Record<string, string[]> = {};
  const globalBoundKeys = Object.entries(bindings)
    .filter(([, v]) => !!v?.boundResultNodeId)
    .map(([k]) => k);

  for (const input of inputs) {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];
    for (const obj of inputData) {
      if (isImageObject(obj)) {
        const imageObj = obj as { id: string };
        const objectId = imageObj.id;
        const objectKeys = Object.keys(bindingsByObject?.[objectId] ?? {});
        const combinedRaw = Array.from(new Set([...globalBoundKeys, ...objectKeys].map(String)));
        const combined = combinedRaw.map(toMediaFieldPath);
        if (combined.length > 0) perObjectBoundFields[objectId] = combined;
      }
    }
  }

  const upstreamBatchOverrides = extractPerObjectBatchOverridesFromInputs(inputs);

  const mergedPerObjectBatchOverrides = (() => {
    const combined = mergeOverrideMaps([upstreamBatchOverrides, emittedPerObjectBatchOverrides]);
    return Object.keys(combined).length > 0 ? combined : undefined;
  })();

  const mergedPerObjectBoundFields: Record<string, string[]> | undefined = (() => {
    const out: Record<string, string[]> = {};
    for (const input of inputs) {
      const upstreamMeta = input?.metadata?.perObjectBoundFields;
      if (upstreamMeta && typeof upstreamMeta === 'object') {
        for (const [objId, keys] of Object.entries(upstreamMeta)) {
          if (Array.isArray(keys)) {
            const existing = out[objId] ?? [];
            out[objId] = Array.from(new Set([...existing, ...keys.map(String)]));
          }
        }
      }
    }
    for (const [objId, keys] of Object.entries(perObjectBoundFields)) {
      const existing = out[objId] ?? [];
      out[objId] = Array.from(new Set([...existing, ...keys.map(String)]));
    }
    return Object.keys(out).length > 0 ? out : undefined;
  })();

  setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', processedObjects, {
    perObjectTimeCursor: extractCursorsFromInputs(inputs),
    perObjectAnimations: extractPerObjectAnimationsFromInputs(inputs),
    perObjectAssignments: mergedAssignments,
    perObjectBatchOverrides: mergedPerObjectBatchOverrides,
    perObjectBoundFields: mergedPerObjectBoundFields,
  });

  logger.info(`Media processing applied: ${processedObjects.length} objects processed`);
}

function isImageObject(obj: unknown): obj is SceneObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'image' &&
    'initialPosition' in obj &&
    'initialRotation' in obj &&
    'initialScale' in obj &&
    'initialOpacity' in obj &&
    'properties' in obj
  );
}

async function processImageObject(
  obj: SceneObject,
  nodeOverrides: MediaOverrides,
  assignments: PerObjectAssignments | undefined,
  bindingsByObject: Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>,
  readVarForObject: (objectId: string | undefined) => (key: string) => unknown,
  _context: ExecutionContext
): Promise<SceneObject> {
  const objectId = obj.id;

  const bindingLookupId = resolveBindingLookupId(
    bindingsByObject as Record<string, unknown>,
    String(objectId)
  );

  const reader = readVarForObject(bindingLookupId);

  const objectOverrides: MediaOverrides = { ...nodeOverrides };
  const objectKeys = getObjectBindingKeys(
    bindingsByObject as Record<string, Record<string, unknown>>,
    String(objectId)
  );

  for (const key of objectKeys) {
    const val = reader(key);
    if (val === undefined) continue;

    switch (key) {
      case 'imageAssetId':
        if (typeof val === 'string') objectOverrides.imageAssetId = val;
        break;
      case 'cropX':
        if (typeof val === 'number') objectOverrides.cropX = val;
        break;
      case 'cropY':
        if (typeof val === 'number') objectOverrides.cropY = val;
        break;
      case 'cropWidth':
        if (typeof val === 'number') objectOverrides.cropWidth = val;
        break;
      case 'cropHeight':
        if (typeof val === 'number') objectOverrides.cropHeight = val;
        break;
      case 'displayWidth':
        if (typeof val === 'number') objectOverrides.displayWidth = val;
        break;
      case 'displayHeight':
        if (typeof val === 'number') objectOverrides.displayHeight = val;
        break;
    }
  }

  const assignment = pickAssignmentsForObject(assignments, String(objectId));
  const initial = assignment?.initial ?? {};

  const batchResolvedAssetId =
    obj.type === 'image' &&
    obj.properties &&
    typeof (obj.properties as { assetId?: string }).assetId === 'string'
      ? (obj.properties as { assetId?: string }).assetId
      : undefined;

  const mediaCanvasOverrides = {
    position: objectOverrides.position,
    rotation: objectOverrides.rotation,
    scale: objectOverrides.scale,
    opacity: objectOverrides.opacity,
    fillColor: '#4444ff',
    strokeColor: '#ffffff',
    strokeWidth: 2,
  };

  const {
    initialPosition,
    initialRotation,
    initialScale,
    initialOpacity,
    properties: resolvedProperties,
  } = resolveInitialObject(obj, mediaCanvasOverrides, assignment);

  const finalOverrides = {
    ...(batchResolvedAssetId && { imageAssetId: batchResolvedAssetId }),
    ...objectOverrides,
    ...initial,
  };

  return {
    ...obj,
    initialPosition,
    initialRotation,
    initialScale,
    initialOpacity,
    properties: {
      ...resolvedProperties,
      ...(finalOverrides.imageAssetId?.trim()
        ? { assetId: finalOverrides.imageAssetId }
        : (() => {
            logger.debug(`Media node processed object ${objectId} without assetId`, {
              objectId,
              hasImageAssetId: !!finalOverrides.imageAssetId,
              imageAssetIdValue: finalOverrides.imageAssetId,
              nodeOverrides: objectOverrides,
            });
            return {};
          })()),
      cropX: finalOverrides.cropX ?? 0,
      cropY: finalOverrides.cropY ?? 0,
      cropWidth: finalOverrides.cropWidth ?? 0,
      cropHeight: finalOverrides.cropHeight ?? 0,
      displayWidth: finalOverrides.displayWidth ?? 0,
      displayHeight: finalOverrides.displayHeight ?? 0,
    },
  };
}
