// src/server/animation-processing/executors/canvas-executor.ts
import type { NodeData } from "@/shared/types";
import {
  setNodeOutput,
  getConnectedInputs,
  type ExecutionContext,
} from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import type { SceneAnimationTrack, SceneObject } from "@/shared/types/scene";
import {
  resolveInitialObject,
  type CanvasOverrides,
} from "@/shared/properties/resolver";
import {
  resolveBindingLookupId,
  getObjectBindingKeys,
  pickAssignmentsForObject,
} from "@/shared/properties/override-utils";
import {
  mergeObjectAssignments,
  isObjectAssignments,
  type PerObjectAssignments,
  type ObjectAssignments,
} from "@/shared/properties/assignments";
import { deleteByPath } from "@/shared/utils/object-path";

// Helper types for better type safety
interface VariableBinding {
  target?: string;
  boundResultNodeId?: string;
}

interface NodeDataWithBindings {
  position?: { x: number; y: number };
  rotation?: number;
  scale?: { x: number; y: number };
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  variableBindings?: Record<string, VariableBinding>;
  variableBindingsByObject?: Record<string, Record<string, VariableBinding>>;
  perObjectAssignments?: PerObjectAssignments;
}

interface InputWithMetadata {
  data: unknown;
  metadata?: {
    perObjectTimeCursor?: Record<string, number>;
    perObjectAnimations?: Record<string, SceneAnimationTrack[]>;
    perObjectAssignments?: PerObjectAssignments;
  };
}

// Type guard for scene objects
function isSceneObject(obj: unknown): obj is SceneObject {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "type" in obj &&
    "properties" in obj &&
    "initialPosition" in obj
  );
}

export class CanvasNodeExecutor extends BaseExecutor {
  protected registerHandlers(): void {
    this.registerHandler("canvas", this.executeCanvas.bind(this));
  }

  private async executeCanvas(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as NodeDataWithBindings;
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
    ) as InputWithMetadata[];

    // Resolve variable bindings (Result nodes) at node level
    const bindings = data.variableBindings ?? {};
    const bindingsByObject = data.variableBindingsByObject ?? {};
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
    // Apply bound values to node defaults

    // Start with node defaults as overrides
    const baseOverrides: CanvasOverrides = {
      position: data.position,
      rotation: data.rotation,
      scale: data.scale,
      opacity: data.opacity,
      fillColor: data.fillColor,
      strokeColor: data.strokeColor,
      strokeWidth: data.strokeWidth,
    };

    // Apply all global binding keys generically into baseOverrides
    const globalKeys = Object.keys(bindings);
    const nodeOverrides: CanvasOverrides = JSON.parse(
      JSON.stringify(baseOverrides),
    ) as CanvasOverrides;
    for (const key of globalKeys) {
      const val = readVarGlobal(key);
      if (val === undefined) continue;

      // Type-safe property setting for CanvasOverrides
      if (key === "position.x" && typeof val === "number") {
        nodeOverrides.position = {
          x: val,
          y: nodeOverrides.position?.y ?? 540,
        };
      } else if (key === "position.y" && typeof val === "number") {
        nodeOverrides.position = {
          x: nodeOverrides.position?.x ?? 960,
          y: val,
        };
      } else if (key === "scale.x" && typeof val === "number") {
        nodeOverrides.scale = {
          x: val,
          y: nodeOverrides.scale?.y ?? 1,
        };
      } else if (key === "scale.y" && typeof val === "number") {
        nodeOverrides.scale = {
          x: nodeOverrides.scale?.x ?? 1,
          y: val,
        };
      } else if (key === "rotation" && typeof val === "number") {
        nodeOverrides.rotation = val;
      } else if (key === "opacity" && typeof val === "number") {
        nodeOverrides.opacity = val;
      } else if (key === "fillColor" && typeof val === "string") {
        nodeOverrides.fillColor = val;
      } else if (key === "strokeColor" && typeof val === "string") {
        nodeOverrides.strokeColor = val;
      } else if (key === "strokeWidth" && typeof val === "number") {
        nodeOverrides.strokeWidth = val;
      }
    }

    const passThrough: unknown[] = [];

    // Read optional per-object assignments metadata (from upstream)
    const upstreamAssignments: PerObjectAssignments | undefined =
      this.extractPerObjectAssignments(inputs);
    // Read node-level assignments stored on the Canvas node itself
    const nodeAssignments: PerObjectAssignments | undefined =
      data.perObjectAssignments;

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

    // Emit perObjectBatchOverrides from node.data.batchOverridesByField
    const batchOverridesByField =
      (
        data as unknown as {
          batchOverridesByField?: Record<
            string,
            Record<string, Record<string, unknown>>
          >;
        }
      ).batchOverridesByField ?? {};

    const emittedPerObjectBatchOverrides: Record<
      string,
      Record<string, Record<string, unknown>>
    > = {};
    for (const [fieldPath, byObject] of Object.entries(batchOverridesByField)) {
      for (const [objectId, byKey] of Object.entries(byObject)) {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(byKey)) {
          const key = String(k).trim();
          if (!key) {
            // Drop invalid keys at emission time
            continue;
          }
          cleaned[key] = v;
        }
        emittedPerObjectBatchOverrides[objectId] ??= {};
        emittedPerObjectBatchOverrides[objectId][fieldPath] = {
          ...(emittedPerObjectBatchOverrides[objectId][fieldPath] ?? {}),
          ...cleaned,
        };
      }
    }

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const obj of inputData) {
        if (isSceneObject(obj)) {
          const original = obj;
          const objectId = original.id;

          const isTextObject = original.type === "text";

          // Unified binding lookup id across object types
          const bindingLookupId = resolveBindingLookupId(
            bindingsByObject as Record<string, unknown>,
            objectId,
          );

          const reader = readVarForObject(bindingLookupId);
          const objectOverrides: CanvasOverrides = JSON.parse(
            JSON.stringify(nodeOverrides),
          ) as CanvasOverrides;

          // Remove color properties for text objects (handled by typography)
          if (isTextObject) {
            delete objectOverrides.fillColor;
            delete objectOverrides.strokeColor;
            delete objectOverrides.strokeWidth;
          }

          const objectKeys = getObjectBindingKeys(
            bindingsByObject as Record<string, Record<string, unknown>>,
            objectId,
          );
          for (const key of objectKeys) {
            const val = reader(key);
            if (val === undefined) continue;

            // Skip color binding keys for text objects (handled by typography)
            if (
              isTextObject &&
              (key === "fillColor" ||
                key === "strokeColor" ||
                key === "strokeWidth")
            ) {
              continue;
            }

            if (key === "position.x" && typeof val === "number") {
              objectOverrides.position = {
                x: val,
                y: objectOverrides.position?.y ?? 540,
              };
            } else if (key === "position.y" && typeof val === "number") {
              objectOverrides.position = {
                x: objectOverrides.position?.x ?? 960,
                y: val,
              };
            } else if (key === "scale.x" && typeof val === "number") {
              objectOverrides.scale = {
                x: val,
                y: objectOverrides.scale?.y ?? 1,
              };
            } else if (key === "scale.y" && typeof val === "number") {
              objectOverrides.scale = {
                x: objectOverrides.scale?.x ?? 1,
                y: val,
              };
            } else if (key === "rotation" && typeof val === "number") {
              objectOverrides.rotation = val;
            } else if (key === "opacity" && typeof val === "number") {
              objectOverrides.opacity = val;
            } else if (key === "fillColor" && typeof val === "string") {
              objectOverrides.fillColor = val;
            } else if (key === "strokeColor" && typeof val === "string") {
              objectOverrides.strokeColor = val;
            } else if (key === "strokeWidth" && typeof val === "number") {
              objectOverrides.strokeWidth = val;
            }
          }

          const assignmentsForObject = pickAssignmentsForObject(
            mergedAssignments,
            objectId,
          );
          const maskedAssignmentsForObject = (() => {
            if (!assignmentsForObject) return undefined;
            const keys = objectKeys; // ✅ Only use per-object bindings, not global keys
            const next: ObjectAssignments = { ...assignmentsForObject };
            const initial = { ...(next.initial ?? {}) } as Record<
              string,
              unknown
            >;

            // Remove properties that are bound by variables
            for (const key of keys) {
              switch (key) {
                case "position.x":
                  deleteByPath(initial, "position.x");
                  break;
                case "position.y":
                  deleteByPath(initial, "position.y");
                  break;
                case "scale.x":
                  deleteByPath(initial, "scale.x");
                  break;
                case "scale.y":
                  deleteByPath(initial, "scale.y");
                  break;
                case "rotation":
                  delete initial.rotation;
                  break;
                case "opacity":
                  delete initial.opacity;
                  break;
                case "fillColor":
                  delete initial.fillColor;
                  break;
                case "strokeColor":
                  delete initial.strokeColor;
                  break;
                case "strokeWidth":
                  delete initial.strokeWidth;
                  break;
                default:
                  break;
              }
            }

            // Remove color assignments for text objects (handled by typography)
            if (isTextObject) {
              delete initial.fillColor;
              delete initial.strokeColor;
              delete initial.strokeWidth;
            }

            // Prune empty objects recursively
            const prunedInitial = (() => {
              const obj = JSON.parse(JSON.stringify(initial)) as Record<
                string,
                unknown
              >;
              const prune = (
                o: Record<string, unknown>,
              ): Record<string, unknown> => {
                for (const k of Object.keys(o)) {
                  if (
                    o[k] &&
                    typeof o[k] === "object" &&
                    !Array.isArray(o[k])
                  ) {
                    o[k] = prune(o[k] as Record<string, unknown>);
                    if (
                      Object.keys(o[k] as Record<string, unknown>).length === 0
                    ) {
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

          const {
            initialPosition,
            initialRotation,
            initialScale,
            initialOpacity,
            initialFillColor,
            initialStrokeColor,
            initialStrokeWidth,
            properties,
          } = resolveInitialObject(
            original,
            objectOverrides,
            maskedAssignmentsForObject,
          );

          const styled: SceneObject = {
            ...original,
            initialPosition,
            initialRotation,
            initialScale,
            initialOpacity,
            initialFillColor,
            initialStrokeColor,
            initialStrokeWidth,
            properties,
          };
          passThrough.push(styled);
        } else {
          passThrough.push(obj);
        }
      }
    }

    // Merge upstream metadata with this node's emissions so multiple editors can contribute
    // Collect metadata from ALL inputs, not just the first one
    const upstreamMetas: Array<{
      perObjectBatchOverrides?: Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      perObjectBoundFields?: Record<string, string[]>;
      perObjectTimeCursor?: Record<string, number>;
      perObjectAnimations?: Record<string, SceneAnimationTrack[]>;
      perObjectAssignments?: PerObjectAssignments;
    }> = inputs
      .map((input) => input?.metadata)
      .filter((meta): meta is NonNullable<typeof meta> => meta != null)
      .map(
        (meta) =>
          meta as {
            perObjectBatchOverrides?: Record<
              string,
              Record<string, Record<string, unknown>>
            >;
            perObjectBoundFields?: Record<string, string[]>;
            perObjectTimeCursor?: Record<string, number>;
            perObjectAnimations?: Record<string, SceneAnimationTrack[]>;
            perObjectAssignments?: PerObjectAssignments;
          },
      );

    // Emit bound fields per object: merge per-object-specific and global bindings
    const perObjectBoundFields: Record<string, string[]> = {};
    const globalBoundKeys = Object.keys(bindings);
    // Collect from processed objects only (ensures object IDs are available)
    for (const obj of passThrough) {
      if (!isSceneObject(obj)) continue;
      const objectId = obj.id;
      const objectKeys = Object.keys(bindingsByObject[objectId] ?? {});
      const combined = Array.from(
        new Set([...globalBoundKeys, ...objectKeys].map(String)),
      );
      if (combined.length > 0) perObjectBoundFields[objectId] = combined;
    }

    // Merge all metadata from upstream inputs
    const mergedPerObjectBatchOverrides:
      | Record<string, Record<string, Record<string, unknown>>>
      | undefined = (() => {
      const out: Record<string, Record<string, Record<string, unknown>>> = {};

      // Merge upstream batch overrides from ALL inputs
      for (const upstreamMeta of upstreamMetas) {
        const upstream = upstreamMeta?.perObjectBatchOverrides;
        if (upstream) {
          for (const [objectId, fields] of Object.entries(upstream)) {
            const destFields = out[objectId] ?? {};
            for (const [fieldPath, byKey] of Object.entries(fields)) {
              const existingByKey = destFields[fieldPath] ?? {};
              destFields[fieldPath] = { ...existingByKey, ...byKey };
            }
            out[objectId] = destFields;
          }
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
        for (const upstreamMeta of upstreamMetas) {
          if (upstreamMeta?.perObjectBoundFields) {
            for (const [objId, keys] of Object.entries(
              upstreamMeta.perObjectBoundFields,
            )) {
              const existing = out[objId] ?? [];
              out[objId] = Array.from(
                new Set([...existing, ...keys.map(String)]),
              );
            }
          }
        }
        // Merge this node's
        for (const [objId, keys] of Object.entries(perObjectBoundFields)) {
          const existing = out[objId] ?? [];
          out[objId] = Array.from(new Set([...existing, ...keys.map(String)]));
        }
        return Object.keys(out).length > 0 ? out : undefined;
      })();

    // Collect other metadata from first input (or any input with data)
    const firstMetaWithData =
      upstreamMetas.find(
        (meta) =>
          meta.perObjectTimeCursor ??
          meta.perObjectAnimations ??
          meta.perObjectAssignments,
      ) ?? upstreamMetas[0];

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      passThrough,
      {
        perObjectTimeCursor: firstMetaWithData?.perObjectTimeCursor,
        perObjectAnimations: firstMetaWithData?.perObjectAnimations,
        perObjectAssignments:
          mergedAssignments ?? firstMetaWithData?.perObjectAssignments,
        perObjectBatchOverrides: mergedPerObjectBatchOverrides,
        perObjectBoundFields: mergedPerObjectBoundFields,
      },
    );
  }

  private extractPerObjectAssignments(
    inputs: InputWithMetadata[],
  ): PerObjectAssignments | undefined {
    const merged: PerObjectAssignments = {};
    let found = false;
    for (const input of inputs) {
      const fromMeta = input.metadata?.perObjectAssignments;
      if (!fromMeta) continue;
      for (const [objectId, assignment] of Object.entries(fromMeta)) {
        if (!isObjectAssignments(assignment)) continue;
        found = true;
        const base = merged[objectId];
        const combined = mergeObjectAssignments(base, assignment);
        if (combined) merged[objectId] = combined;
      }
    }
    return found ? merged : undefined;
  }
}
