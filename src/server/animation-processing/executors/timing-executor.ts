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

    const timedObjects: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(
      inputs as unknown as ExecutionValue[],
    );

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const objectDef of inputData) {
        if (typeof objectDef === "object" && objectDef !== null) {
          const timedObject: Record<string, unknown> = {
            ...(objectDef as Record<string, unknown>),
            appearanceTime: Number(data.appearanceTime),
          };
          timedObjects.push(timedObject);
        }
      }
    }

    context.currentTime = Math.max(
      context.currentTime,
      data.appearanceTime as number,
    );
    // Clone perObjectAnimations to prevent shared reference mutations
    const sourceAnimations = (
      inputs[0]?.metadata as
        | { perObjectAnimations?: Record<string, SceneAnimationTrack[]> }
        | undefined
    )?.perObjectAnimations;
    const clonedAnimations = sourceAnimations
      ? Object.fromEntries(
          Object.entries(sourceAnimations).map(([objectId, animations]) => [
            objectId,
            animations.map((anim) => ({
              ...anim,
              properties: { ...anim.properties },
            })),
          ]),
        )
      : undefined;

    // Merge batch overrides from ALL inputs, not just the first one
    const mergedPerObjectBatchOverrides: | Record<string, Record<string, Record<string, unknown>>> | undefined = (() => {
      const out: Record<string, Record<string, Record<string, unknown>>> = {};
      for (const input of inputs) {
        const upstream = input?.metadata?.perObjectBatchOverrides;
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
      return Object.keys(out).length > 0 ? out : undefined;
    })();

    const mergedPerObjectBoundFields: Record<string, string[]> | undefined = (() => {
      const out: Record<string, string[]> = {};
      for (const input of inputs) {
        const upstream = input?.metadata?.perObjectBoundFields;
        if (upstream) {
          for (const [objId, keys] of Object.entries(upstream)) {
            const existing = out[objId] ?? [];
            out[objId] = Array.from(new Set([...existing, ...keys.map(String)]));
          }
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
