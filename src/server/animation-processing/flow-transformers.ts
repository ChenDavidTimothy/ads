import type { ReactFlowNode } from "@/server/animation-processing/execution-engine";
import type {
  BatchedScenePartition,
  ScenePartition,
} from "@/server/animation-processing/scene/scene-partitioner";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { NodeData } from "@/shared/types";
import type { SceneAnimationTrack, SceneObject } from "@/shared/types/scene";

export type BackendNode = {
  id: string;
  type: string | undefined;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type BackendEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

interface Point2DValue {
  x?: number;
  y?: number;
}

interface PropertySchema {
  key: string;
  type: string;
  defaultValue?: unknown;
}

interface NodeDefinitionWithDefaults {
  defaults?: Record<string, unknown>;
  properties?: {
    properties?: PropertySchema[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPoint2DValue(value: unknown): value is Point2DValue {
  if (!isRecord(value)) return false;
  const x = value.x;
  const y = value.y;
  const validX =
    x === undefined || (typeof x === "number" && Number.isFinite(x));
  const validY =
    y === undefined || (typeof y === "number" && Number.isFinite(y));
  return validX && validY;
}

function toPoint2DValue(value: unknown): Point2DValue | undefined {
  if (isPoint2DValue(value)) {
    return {
      x: value.x,
      y: value.y,
    };
  }

  if (isRecord(value)) {
    const candidateX = value.x;
    const candidateY = value.y;
    const xValue =
      typeof candidateX === "number" && Number.isFinite(candidateX)
        ? candidateX
        : undefined;
    const yValue =
      typeof candidateY === "number" && Number.isFinite(candidateY)
        ? candidateY
        : undefined;

    if (xValue !== undefined || yValue !== undefined) {
      return {
        x: xValue,
        y: yValue,
      };
    }
  }

  return undefined;
}

function hasIdentifier(data: unknown): data is { identifier: { id: string } } {
  return (
    typeof data === "object" &&
    data !== null &&
    "identifier" in data &&
    typeof (data as { identifier: unknown }).identifier === "object" &&
    (data as { identifier: unknown }).identifier !== null &&
    "id" in (data as { identifier: { id: unknown } }).identifier &&
    typeof (data as { identifier: { id: unknown } }).identifier.id === "string"
  );
}

export function mergeNodeDataWithDefaults(
  nodeType: string | undefined,
  rawData: unknown,
): Record<string, unknown> {
  const definition = (nodeType ? getNodeDefinition(nodeType) : undefined) as
    | NodeDefinitionWithDefaults
    | undefined;
  const defaults = definition?.defaults ?? {};
  const data: Record<string, unknown> = isRecord(rawData) ? rawData : {};

  const propertySchemas = definition?.properties?.properties ?? [];
  const point2dKeys = new Set(
    propertySchemas
      .filter((schema) => schema.type === "point2d")
      .map((schema) => schema.key),
  );

  const merged: Record<string, unknown> = { ...defaults };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (point2dKeys.has(key)) {
      const base = toPoint2DValue(defaults[key]) ?? {};
      const override = toPoint2DValue(value) ?? {};
      merged[key] = { ...base, ...override };
    } else {
      merged[key] = value;
    }
  }

  for (const schema of propertySchemas) {
    if (schema.type !== "point2d") continue;

    const provided = toPoint2DValue(data[schema.key]);
    const nodeDefault = toPoint2DValue(defaults[schema.key]);
    const schemaDefault = toPoint2DValue(schema.defaultValue);
    const currentMerged = toPoint2DValue(merged[schema.key]);

    const x =
      provided?.x ??
      currentMerged?.x ??
      nodeDefault?.x ??
      schemaDefault?.x ??
      0;

    const y =
      provided?.y ??
      currentMerged?.y ??
      nodeDefault?.y ??
      schemaDefault?.y ??
      0;

    merged[schema.key] = { x, y };
  }

  return merged;
}

export function createNodeIdMap(
  nodes: Array<{ id: string; data?: unknown }>,
): Map<string, string> {
  const nodeIdMap = new Map<string, string>();
  nodes.forEach((node) => {
    if (hasIdentifier(node.data)) {
      nodeIdMap.set(node.id, node.data.identifier.id);
    }
  });
  return nodeIdMap;
}

export function convertBackendNodeToReactFlowNode(
  backendNode: BackendNode,
): ReactFlowNode<NodeData> {
  return {
    id: backendNode.id,
    type: backendNode.type,
    position: backendNode.position,
    data: backendNode.data as unknown as NodeData,
  };
}

function namespaceObjectsForBatch(
  objects: SceneObject[],
  batchKey: string | null,
): SceneObject[] {
  if (!batchKey) return objects;
  const suffix = `@${batchKey}`;
  return objects.map((object) => ({ ...object, id: `${object.id}${suffix}` }));
}

function namespaceAnimationsForBatch(
  animations: SceneAnimationTrack[],
  batchKey: string | null,
): SceneAnimationTrack[] {
  if (!batchKey) return animations;
  const suffix = `@${batchKey}`;
  return animations.map((animation) => ({
    ...animation,
    id: `${animation.id}${suffix}`,
    objectId: `${animation.objectId}${suffix}`,
  }));
}

function namespaceBatchOverridesForBatch(
  batchOverrides:
    | Record<string, Record<string, Record<string, unknown>>>
    | undefined,
  batchKey: string | null,
): Record<string, Record<string, Record<string, unknown>>> | undefined {
  if (!batchOverrides) return batchOverrides;
  if (!batchKey) return { ...batchOverrides };
  const suffix = `@${batchKey}`;
  const namespaced: Record<string, Record<string, Record<string, unknown>>> = {
    ...batchOverrides,
  };

  for (const [objectId, fieldOverrides] of Object.entries(batchOverrides)) {
    namespaced[`${objectId}${suffix}`] = fieldOverrides;
  }

  return namespaced;
}

function namespaceBoundFieldsForBatch(
  bound: Record<string, string[]> | undefined,
  batchKey: string | null,
): Record<string, string[]> | undefined {
  if (!bound) return bound;
  if (!batchKey) return { ...bound };
  const suffix = `@${batchKey}`;
  const out: Record<string, string[]> = { ...bound };
  for (const [objectId, keys] of Object.entries(bound)) {
    out[`${objectId}${suffix}`] = [...keys];
  }
  return out;
}

export function namespacePartitionForBatch(
  partition: ScenePartition,
  batchKey: string | null,
): BatchedScenePartition {
  return {
    sceneNode: partition.sceneNode,
    objects: namespaceObjectsForBatch(partition.objects, batchKey),
    animations: namespaceAnimationsForBatch(partition.animations, batchKey),
    batchOverrides: namespaceBatchOverridesForBatch(
      partition.batchOverrides,
      batchKey,
    ),
    boundFieldsByObject: namespaceBoundFieldsForBatch(
      partition.boundFieldsByObject,
      batchKey,
    ),
    batchKey,
  };
}
