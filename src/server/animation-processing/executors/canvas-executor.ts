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
  mergeObjectAssignments,
  isObjectAssignments,
  type PerObjectAssignments,
  type ObjectAssignments,
} from "@/shared/properties/assignments";
import { deleteByPath } from "@/shared/utils/object-path";
import { buildSparseOverrides, buildSparsePoint2DOverride } from "@/shared/properties/inheritance";

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
  inherit?: {
    position?: { x?: boolean; y?: boolean };
    rotation?: boolean;
    scale?: { x?: boolean; y?: boolean };
    opacity?: boolean;
    fillColor?: boolean;
    strokeColor?: boolean;
    strokeWidth?: boolean;
  };
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

    // Build sparse node-level overrides honoring inherit flags
    const nodeBoundValues: Record<string, unknown> = {};
    for (const key of Object.keys(bindings)) {
      const v = readVarGlobal(key);
      if (v !== undefined) nodeBoundValues[key] = v;
    }

    const defaultScope = {
      nodeDefaults: {
        position: data.position,
        rotation: data.rotation,
        scale: data.scale,
        opacity: data.opacity,
        fillColor: data.fillColor,
        strokeColor: data.strokeColor,
        strokeWidth: data.strokeWidth,
      } as Record<string, unknown>,
      nodeBoundValues,
      inherit: data.inherit as Record<string, unknown> | undefined,
    };

    const pointOverrides = {
      ...buildSparsePoint2DOverride("position", defaultScope),
      ...buildSparsePoint2DOverride("scale", defaultScope),
    } as Partial<CanvasOverrides>;

    const scalarOverrides = buildSparseOverrides<
      Record<string, number | string>
    >(
      ["rotation", "opacity", "fillColor", "strokeColor", "strokeWidth"],
      defaultScope,
    ) as Partial<CanvasOverrides>;

    const nodeOverrides: CanvasOverrides = {
      ...pointOverrides,
      ...scalarOverrides,
    } as CanvasOverrides;

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

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const obj of inputData) {
        if (isSceneObject(obj)) {
          const original = obj;
          const objectId = original.id;

          // NEW: Add type-aware color property filtering
          const isTextObject = original.type === "text";

          const reader = readVarForObject(objectId);
          const objectOverrides: CanvasOverrides = JSON.parse(
            JSON.stringify(nodeOverrides),
          ) as CanvasOverrides;

          // NEW: Remove color properties for text objects
          if (isTextObject) {
            delete objectOverrides.fillColor;
            delete objectOverrides.strokeColor;
            delete objectOverrides.strokeWidth;
          }

          const objectKeys = Object.keys(bindingsByObject[objectId] ?? {});
          for (const key of objectKeys) {
            const val = reader(key);
            if (val === undefined) continue;

            // NEW: Skip color binding keys for text objects
            if (
              isTextObject &&
              (key === "fillColor" ||
                key === "strokeColor" ||
                key === "strokeWidth")
            ) {
              continue;
            }

            // EXISTING: Keep all existing property binding logic unchanged
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

          const assignmentsForObject = mergedAssignments?.[objectId];
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

            // NEW: Also remove color assignments for text objects (even if not bound)
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

    // Pass through existing per-object animations/cursors and the merged assignments
    const firstMeta = inputs[0]?.metadata;

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      passThrough,
      {
        perObjectTimeCursor: firstMeta?.perObjectTimeCursor,
        perObjectAnimations: firstMeta?.perObjectAnimations,
        perObjectAssignments:
          mergedAssignments ?? firstMeta?.perObjectAssignments,
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
