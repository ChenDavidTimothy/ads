// src/server/animation-processing/executors/timing-executor.ts
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { isPerObjectCursorMap, mergeCursorMaps } from "../scene/scene-assembler";

export class TimingNodeExecutor extends BaseExecutor {
  // Register timing node handlers
  protected registerHandlers(): void {
    this.registerHandler('insert', (node, context, connections) => this.executeInsert(node, context, connections));
  }



  private async executeInsert(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    const timedObjects: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const objectDef of inputData) {
        if (typeof objectDef === 'object' && objectDef !== null) {
          const timedObject: Record<string, unknown> = {
            ...(objectDef as Record<string, unknown>),
            appearanceTime: Number(data.appearanceTime),
          };
          timedObjects.push(timedObject);
        }
      }
    }

    context.currentTime = Math.max(context.currentTime, data.appearanceTime as number);
    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      timedObjects,
      { perObjectTimeCursor: upstreamCursorMap }
    );
  }

  private extractCursorsFromInputs(inputs: ExecutionValue[]): Record<string, number> {
    const maps: Record<string, number>[] = [];
    for (const input of inputs) {
      const maybeMap = (input.metadata as { perObjectTimeCursor?: unknown } | undefined)?.perObjectTimeCursor;
      if (isPerObjectCursorMap(maybeMap)) {
        maps.push(maybeMap);
      }
    }
    return mergeCursorMaps(maps);
  }
}


