import type { ReactFlowNode, ReactFlowEdge } from "../../types/graph";
import {
  setNodeOutput,
  getConnectedInputs,
  type ExecutionContext,
} from "../../execution-context";
import type { NodeData } from "@/shared/types";
import type {
  SceneObject,
  TextProperties,
  SceneAnimationTrack,
} from "@/shared/types/scene";
import type {
  PerObjectAssignments,
  ObjectAssignments,
} from "@/shared/properties/assignments";
import { mergeObjectAssignments } from "@/shared/properties/assignments";
import {
  resolveBindingLookupId,
  getObjectBindingKeys,
  pickAssignmentsForObject,
} from "@/shared/properties/override-utils";
import { logger } from "@/lib/logger";
import {
  extractPerObjectAssignmentsFromInputs,
  extractPerObjectBatchOverridesFromInputs,
  extractCursorsFromInputs,
  extractPerObjectAnimationsFromInputs,
  clonePerObjectAnimations,
} from "../shared/per-object-helpers";
import { toDisplayString } from "../shared/common";

export async function executeTypographyNode(
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

  logger.warn(
    `DEBUG Starting typography execution: ${node.data.identifier.displayName}`,
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
        else {
          const rid = bindings[key]?.boundResultNodeId;
          const entry = rid
            ? (context.nodeOutputs.get(`${rid}.output`) ??
              context.nodeOutputs.get(`${rid}.result`))
            : undefined;
          const display = (
            entry?.metadata as { displayValue?: unknown } | undefined
          )?.displayValue;
          if (typeof display === "string") nodeOverrides.content = display;
          else nodeOverrides.content = toDisplayString(val);
        }
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
  const upstreamCursorMap = extractCursorsFromInputs(inputs);
  const outputCursorMap: Record<string, number> = { ...upstreamCursorMap };
  const perObjectAnimations: Record<string, SceneAnimationTrack[]> =
    extractPerObjectAnimationsFromInputs(inputs);

  // Read optional per-object assignments metadata (from upstream)
  const upstreamAssignments: PerObjectAssignments | undefined =
    extractPerObjectAssignmentsFromInputs(inputs);
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
      if (isTextObject(obj)) {
        const processed = processTextObject(
          obj,
          nodeOverrides,
          mergedAssignments,
          bindingsByObject,
          readVarForObject,
          context,
        );
        processedObjects.push(processed);
      } else {
        // Pass through non-text objects unchanged
        processedObjects.push(obj);
      }
    }
  }

  // Emit perObjectBatchOverrides from node.data.batchOverridesByField (Typography scope)
  const batchOverridesByField =
    (
      data as unknown as {
        batchOverridesByField?: Record<
          string,
          Record<string, Record<string, unknown>>
        >;
      }
    ).batchOverridesByField ?? {};

  logger.warn(
    `DEBUG Typography ${node.data.identifier.displayName} batchOverridesByField:`,
    {
      nodeId: node.data.identifier.id,
      batchOverridesByField: JSON.stringify(batchOverridesByField, null, 2),
    },
  );

  const emittedPerObjectBatchOverrides: Record<
    string,
    Record<string, Record<string, unknown>>
  > = (() => {
    const passedIds = new Set(
      processedObjects
        .filter((o) => isTextObject(o))
        .map((o) => (o as { id: string }).id),
    );
    const defaultMarker = "__default_object__";
    const isBatched = (obj: unknown): boolean => {
      const sceneObj = obj as SceneObject;
      const hasBatch = Boolean(sceneObj?.batch);
      const keys = Array.isArray(sceneObj?.batchKeys) ? sceneObj.batchKeys : [];
      const hasValidKeys = keys.some(
        (k) => typeof k === "string" && k.trim() !== "",
      );
      return hasBatch && hasValidKeys;
    };
    const objectsById = new Map<string, unknown>(
      processedObjects
        .filter((o) => isTextObject(o))
        .map((o) => [o.id ?? "", o]),
    );
    const scoped: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const [fieldPath, byObject] of Object.entries(batchOverridesByField)) {
      for (const [rawObjId, byKey] of Object.entries(byObject)) {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(byKey)) {
          const key = String(k).trim();
          if (!key) continue;
          cleaned[key] = v;
        }
        if (rawObjId === defaultMarker) {
          for (const [oid, obj] of objectsById) {
            if (!passedIds.has(oid)) continue;
            if (!isBatched(obj)) continue;
            scoped[oid] ??= {};
            scoped[oid][fieldPath] = {
              ...(scoped[oid][fieldPath] ?? {}),
              ...cleaned,
            };
          }
        } else if (passedIds.has(rawObjId)) {
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

  logger.warn(
    `DEBUG Typography ${node.data.identifier.displayName} emitted batch overrides:`,
    {
      nodeId: node.data.identifier.id,
      emittedPerObjectBatchOverrides: JSON.stringify(
        emittedPerObjectBatchOverrides,
        null,
        2,
      ),
    },
  );

  // Bound fields mask for typography
  const perObjectBoundFieldsTypo: Record<string, string[]> = {};
  const globalBoundKeysTypo = Object.entries(bindings)
    .filter(([, v]) => !!v?.boundResultNodeId)
    .map(([k]) => k);
  for (const input of inputs) {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];
    for (const obj of inputData) {
      if (isTextObject(obj)) {
        const textObj = obj as { id: string };
        const objectId = textObj.id;
        const objectKeys = Object.keys(bindingsByObject[objectId] ?? {});
        const combined = Array.from(
          new Set([...globalBoundKeysTypo, ...objectKeys].map(String)),
        );
        if (combined.length > 0) perObjectBoundFieldsTypo[objectId] = combined;
      }
    }
  }

  // Extract and merge upstream batch overrides from all inputs
  const upstreamBatchOverrides =
    extractPerObjectBatchOverridesFromInputs(inputs);

  const mergedPerObjectBatchOverrides:
    | Record<string, Record<string, Record<string, unknown>>>
    | undefined = (() => {
    const out: Record<string, Record<string, Record<string, unknown>>> = {};

    // Merge upstream batch overrides
    if (upstreamBatchOverrides) {
      for (const [objectId, fields] of Object.entries(upstreamBatchOverrides)) {
        const destFields = out[objectId] ?? {};
        for (const [fieldPath, byKey] of Object.entries(fields)) {
          const existingByKey = destFields[fieldPath] ?? {};
          destFields[fieldPath] = { ...existingByKey, ...byKey };
        }
        out[objectId] = destFields;
      }
    }

    // Merge this node's emissions
    for (const [objectId, fields] of Object.entries(
      emittedPerObjectBatchOverrides,
    )) {
      const destFields = out[objectId] ?? {};
      for (const [fieldPath, byKey] of Object.entries(fields)) {
        const existingByKey = destFields[fieldPath] ?? {};
        destFields[fieldPath] = { ...existingByKey, ...byKey };
      }
      out[objectId] = destFields;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  })();

  const mergedPerObjectBoundFields: Record<string, string[]> | undefined =
    (() => {
      const out: Record<string, string[]> = {};
      // Start with upstream from ALL inputs
      for (const input of inputs) {
        const upstreamMeta = input?.metadata?.perObjectBoundFields;
        if (upstreamMeta && typeof upstreamMeta === "object") {
          for (const [objId, keys] of Object.entries(upstreamMeta)) {
            if (Array.isArray(keys)) {
              const existing = out[objId] ?? [];
              out[objId] = Array.from(
                new Set([...existing, ...keys.map(String)]),
              );
            }
          }
        }
      }
      // Merge this node's
      const normalizeTypographyKey = (k: string): string =>
        k.startsWith("Typography.")
          ? k
          : [
                "content",
                "fontFamily",
                "fontSize",
                "fontWeight",
                "textAlign",
                "lineHeight",
                "letterSpacing",
                "fontStyle",
                "textBaseline",
                "direction",
                "fillColor",
                "strokeColor",
                "strokeWidth",
              ].includes(k)
            ? `Typography.${k}`
            : k;
      for (const [objId, keys] of Object.entries(perObjectBoundFieldsTypo)) {
        const existing = out[objId] ?? [];
        const normalized = keys.map((k) => normalizeTypographyKey(String(k)));
        out[objId] = Array.from(new Set([...existing, ...normalized]));
      }
      return Object.keys(out).length > 0 ? out : undefined;
    })();

  // Log the processed objects for debugging
  const processedObjectsSummary = processedObjects.map((obj) => {
    const sceneObj = obj as SceneObject;
    return {
      id: sceneObj.id,
      type: sceneObj.type,
      content: (sceneObj.properties as TextProperties)?.content,
      typography: sceneObj.typography,
    };
  });

  logger.warn(
    `DEBUG Typography ${node.data.identifier.displayName} processed objects:`,
    {
      nodeId: node.data.identifier.id,
      processedObjectsSummary: JSON.stringify(processedObjectsSummary, null, 2),
      perObjectBatchOverrides: mergedPerObjectBatchOverrides
        ? JSON.stringify(mergedPerObjectBatchOverrides, null, 2)
        : "none",
    },
  );

  setNodeOutput(
    context,
    node.data.identifier.id,
    "output",
    "object_stream",
    processedObjects,
    {
      perObjectTimeCursor: outputCursorMap,
      perObjectAnimations: clonePerObjectAnimations(perObjectAnimations),
      perObjectAssignments: mergedAssignments,
      perObjectBatchOverrides: mergedPerObjectBatchOverrides,
      // Provide bound field masks for Typography so resolver masks overrides correctly
      perObjectBoundFields: mergedPerObjectBoundFields,
    },
  );

  logger.info(
    `Text styling applied: ${processedObjects.length} objects processed`,
  );
}

// Helper methods (follow Canvas implementation patterns)
function isTextObject(obj: unknown): obj is SceneObject {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    (obj as { type: string }).type === "text"
  );
}

function processTextObject(
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
  readVarForObject: (objectId: string | undefined) => (key: string) => unknown,
  context: ExecutionContext,
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
        case "content": {
          if (typeof value === "string") {
            objectOverrides.content = value;
          } else {
            const rid =
              bindingsByObject[String(objectId)]?.[key]?.boundResultNodeId;
            const entry = rid
              ? (context.nodeOutputs.get(`${rid}.output`) ??
                context.nodeOutputs.get(`${rid}.result`))
              : undefined;
            const display = (
              entry?.metadata as { displayValue?: unknown } | undefined
            )?.displayValue;
            if (typeof display === "string") objectOverrides.content = display;
            else objectOverrides.content = toDisplayString(value);
          }
          break;
        }
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
          if (typeof value === "number") objectOverrides.letterSpacing = value;
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
          if (typeof value === "number") objectOverrides.shadowOffsetX = value;
          break;
        case "shadowOffsetY":
          if (typeof value === "number") objectOverrides.shadowOffsetY = value;
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
  const maskedAssignmentsForObject: ObjectAssignments | undefined = (() => {
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

  const maskedInitial = maskedAssignmentsForObject?.initial as
    | Record<string, unknown>
    | undefined;

  // Apply text styling from assignments
  const finalTypography = {
    content: (maskedInitial?.content as string) ?? objectOverrides.content, // ADD this line
    fontFamily:
      (maskedInitial?.fontFamily as string) ?? objectOverrides.fontFamily,
    fontSize: (maskedInitial?.fontSize as number) ?? objectOverrides.fontSize,
    fontWeight:
      (maskedInitial?.fontWeight as string) ?? objectOverrides.fontWeight,
    textAlign:
      (maskedInitial?.textAlign as string) ?? objectOverrides.textAlign,
    lineHeight:
      (maskedInitial?.lineHeight as number) ?? objectOverrides.lineHeight,
    letterSpacing:
      (maskedInitial?.letterSpacing as number) ?? objectOverrides.letterSpacing,
    fontStyle:
      (maskedInitial?.fontStyle as string) ?? objectOverrides.fontStyle,
    textBaseline:
      (maskedInitial?.textBaseline as string) ?? objectOverrides.textBaseline,
    direction:
      (maskedInitial?.direction as string) ?? objectOverrides.direction,
    // RESTORE: Add color cases back
    fillColor:
      (maskedInitial?.fillColor as string) ?? objectOverrides.fillColor,
    strokeColor:
      (maskedInitial?.strokeColor as string) ?? objectOverrides.strokeColor,
    strokeWidth:
      (maskedInitial?.strokeWidth as number) ?? objectOverrides.strokeWidth,
    shadowColor:
      (maskedInitial?.shadowColor as string) ?? objectOverrides.shadowColor,
    shadowOffsetX:
      (maskedInitial?.shadowOffsetX as number) ?? objectOverrides.shadowOffsetX,
    shadowOffsetY:
      (maskedInitial?.shadowOffsetY as number) ?? objectOverrides.shadowOffsetY,
    shadowBlur:
      (maskedInitial?.shadowBlur as number) ?? objectOverrides.shadowBlur,
    textOpacity:
      (maskedInitial?.textOpacity as number) ?? objectOverrides.textOpacity,
  };

  // CRITICAL: Update both properties.content AND typography.content
  // This ensures content changes are reflected in the rendered output
  // Ensure deep clone to prevent shared references between objects
  const clonedProperties = JSON.parse(
    JSON.stringify(obj.properties),
  ) as TextProperties;

  // Define type for extended typography that includes content
  type ExtendedTypography = NonNullable<SceneObject["typography"]> & {
    content?: string;
  };

  const clonedTypography = JSON.parse(
    JSON.stringify(finalTypography),
  ) as ExtendedTypography;

  return {
    ...obj,
    properties: {
      ...clonedProperties,
      content: clonedTypography.content ?? clonedProperties.content, // Override text content
    },
    typography: clonedTypography,
  };
}
