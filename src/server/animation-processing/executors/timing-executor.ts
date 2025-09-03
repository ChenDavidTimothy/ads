// src/server/animation-processing/executors/timing-executor.ts
import type { NodeData } from "@/shared/types";
import type { SceneAnimationTrack } from "@/shared/types/scene";
import {
  setNodeOutput,
  getConnectedInputs,
  type ExecutionContext,
  type ExecutionValue,
} from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import {
  isPerObjectCursorMap,
  mergeCursorMaps,
} from "../scene/scene-assembler";

export class TimingNodeExecutor extends BaseExecutor {
  // Register timing node handlers
  protected registerHandlers(): void {
    this.registerHandler("insert", (node, context, connections) =>
      this.executeInsert(node, context, connections),
    );
  }

  private async executeInsert(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown> & {
      appearanceTime?: number;
      appearanceTimeByObject?: Record<string, number>;
      variableBindings?: Record<
        string,
        { target?: string; boundResultNodeId?: string }
      >;
      variableBindingsByObject?: Record<
        string,
        Record<string, { target?: string; boundResultNodeId?: string }>
      >;
    };
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

    const timedObjects: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(
      inputs as unknown as ExecutionValue[],
    );

    // Resolve variable bindings (Result nodes) for appearanceTime
    const bindings = (data.variableBindings ?? {}) as Record<
      string,
      { target?: string; boundResultNodeId?: string }
    >;
    const bindingsByObject = (data.variableBindingsByObject ?? {}) as Record<
      string,
      Record<string, { target?: string; boundResultNodeId?: string }>
    >;

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

    let maxAppearanceTimeForNode = 0;

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const objectDef of inputData) {
        if (typeof objectDef === "object" && objectDef !== null) {
          const objectId = (objectDef as Record<string, unknown>).id as
            | string
            | undefined;
          const getNumber = (v: unknown): number | undefined => {
            if (typeof v === "number" && isFinite(v)) return v;
            const n = Number(v as never);
            return isFinite(n) ? n : undefined;
          };

          // Precedence: per-object binding > per-object override > global binding > node default
          const perObjectBoundVal = getNumber(
            readVarForObject(objectId)("appearanceTime"),
          );
          const perObjectOverride =
            objectId && data.appearanceTimeByObject
              ? getNumber(data.appearanceTimeByObject[objectId])
              : undefined;
          const globalBoundVal = getNumber(readVarGlobal("appearanceTime"));
          const nodeDefault = getNumber(data.appearanceTime) ?? 0;

          const appearanceTime = Math.max(
            0,
            perObjectBoundVal ??
              perObjectOverride ??
              globalBoundVal ??
              nodeDefault,
          );

          const timedObject: Record<string, unknown> = {
            ...(objectDef as Record<string, unknown>),
            appearanceTime,
          };
          if (appearanceTime > maxAppearanceTimeForNode) {
            maxAppearanceTimeForNode = appearanceTime;
          }
          timedObjects.push(timedObject);
        }
      }
    }

    context.currentTime = Math.max(
      context.currentTime,
      maxAppearanceTimeForNode,
    );
    // Merge perObjectAnimations from all inputs to prevent shared reference mutations
    const mergedAnimations: Record<string, SceneAnimationTrack[]> = {};
    for (const input of inputs) {
      const sourceAnimations = input?.metadata?.perObjectAnimations as
        | Record<string, SceneAnimationTrack[]>
        | undefined;
      if (sourceAnimations) {
        for (const [objectId, animations] of Object.entries(sourceAnimations)) {
          mergedAnimations[objectId] ??= [];
          mergedAnimations[objectId].push(
            ...animations.map(
              (anim: SceneAnimationTrack) =>
                ({
                  ...anim,
                  properties: {
                    ...anim.properties,
                  },
                }) as SceneAnimationTrack,
            ),
          );
        }
      }
    }
    const clonedAnimations =
      Object.keys(mergedAnimations).length > 0 ? mergedAnimations : undefined;

    // Merge batch overrides from ALL inputs, not just the first one
    const mergedPerObjectBatchOverrides:
      | Record<string, Record<string, Record<string, unknown>>>
      | undefined = (() => {
      const out: Record<string, Record<string, Record<string, unknown>>> = {};
      for (const input of inputs) {
        const upstream = input?.metadata?.perObjectBatchOverrides;
        if (upstream && typeof upstream === "object") {
          for (const [objectId, fields] of Object.entries(upstream)) {
            if (typeof fields === "object" && fields !== null) {
              const destFields = out[objectId] ?? {};
              for (const [fieldPath, byKey] of Object.entries(
                fields as Record<string, unknown>,
              )) {
                if (typeof byKey === "object" && byKey !== null) {
                  const existingByKey = destFields[fieldPath] ?? {};
                  destFields[fieldPath] = {
                    ...existingByKey,
                    ...byKey,
                  };
                }
              }
              out[objectId] = destFields;
            }
          }
        }
      }
      return Object.keys(out).length > 0 ? out : undefined;
    })();

    const mergedPerObjectBoundFields: Record<string, string[]> | undefined =
      (() => {
        const out: Record<string, string[]> = {};
        // Start with upstream bound fields
        for (const input of inputs) {
          const upstream = input?.metadata?.perObjectBoundFields as
            | Record<string, string[]>
            | undefined;
          if (upstream && typeof upstream === "object") {
            for (const [objId, keys] of Object.entries(upstream)) {
              if (Array.isArray(keys)) {
                const existing = out[objId] ?? [];
                out[objId] = Array.from(
                  new Set([...existing, ...keys.map(String)]),
                );
              }
            }
          }
        }

        // Mark appearanceTime as bound when either global or per-object binding exists
        const globalBound = !!bindings.appearanceTime?.boundResultNodeId;

        // To avoid re-traversing inputs, derive object ids from timedObjects
        for (const obj of timedObjects) {
          if (!obj || typeof obj !== "object") continue;
          const objectId = (obj as Record<string, unknown>).id as
            | string
            | undefined;
          if (!objectId) continue;
          const perObjBound =
            !!bindingsByObject[objectId]?.appearanceTime?.boundResultNodeId;
          if (globalBound || perObjBound) {
            const existing = out[objectId] ?? [];
            out[objectId] = Array.from(
              new Set([...existing, "appearanceTime"]),
            );
          }
        }

        return Object.keys(out).length > 0 ? out : undefined;
      })();

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      timedObjects,
      {
        perObjectTimeCursor: upstreamCursorMap,
        perObjectAnimations: clonedAnimations,
        // Pass through merged batch overrides / bound fields from ALL inputs
        ...(mergedPerObjectBatchOverrides && {
          perObjectBatchOverrides: mergedPerObjectBatchOverrides,
        }),
        ...(mergedPerObjectBoundFields && {
          perObjectBoundFields: mergedPerObjectBoundFields,
        }),
      },
    );
  }

  private extractCursorsFromInputs(
    inputs: ExecutionValue[],
  ): Record<string, number> {
    const maps: Record<string, number>[] = [];
    for (const input of inputs) {
      const maybeMap = (
        input.metadata as { perObjectTimeCursor?: unknown } | undefined
      )?.perObjectTimeCursor;
      if (isPerObjectCursorMap(maybeMap)) {
        maps.push(maybeMap);
      }
    }
    return mergeCursorMaps(maps);
  }
}
