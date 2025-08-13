// src/server/animation-processing/executors/canvas-executor.ts
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import type { SceneAnimationTrack } from "@/shared/types/scene";

export class CanvasNodeExecutor extends BaseExecutor {
  protected registerHandlers(): void {
    this.registerHandler('canvas', this.executeCanvas.bind(this));
  }

  private async executeCanvas(
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

    const passThrough: unknown[] = [];

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const obj of inputData) {
        if (typeof obj === 'object' && obj !== null && 'id' in obj) {
          const original = obj as Record<string, unknown>;
          const initialPosition = (data.position as { x: number; y: number }) ?? (original.initialPosition as { x: number; y: number });
          const initialRotation = (data.rotation as number) ?? (original.initialRotation as number) ?? 0;
          const initialScale = (data.scale as { x: number; y: number }) ?? (original.initialScale as { x: number; y: number }) ?? { x: 1, y: 1 };
          const initialOpacity = (data.opacity as number) ?? (original.initialOpacity as number) ?? 1;

          // Override colors if provided
          const properties = { ...(original.properties as Record<string, unknown>) };
          if (typeof data.fillColor === 'string') properties.color = data.fillColor;
          if (typeof data.strokeColor === 'string') properties.strokeColor = data.strokeColor;
          if (typeof data.strokeWidth === 'number') properties.strokeWidth = data.strokeWidth;

          const styled: Record<string, unknown> = {
            ...original,
            initialPosition,
            initialRotation,
            initialScale,
            initialOpacity,
            properties,
          };
          passThrough.push(styled);
        } else {
          passThrough.push(obj);
        }
      }
    }

    // Pass through existing per-object animations/cursors unchanged if present
    const firstMeta = inputs[0]?.metadata as { perObjectTimeCursor?: Record<string, number>; perObjectAnimations?: Record<string, SceneAnimationTrack[]> } | undefined;

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThrough,
      {
        perObjectTimeCursor: firstMeta?.perObjectTimeCursor,
        perObjectAnimations: firstMeta?.perObjectAnimations,
      }
    );
  }
}