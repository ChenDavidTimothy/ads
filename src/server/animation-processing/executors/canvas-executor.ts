// src/server/animation-processing/executors/canvas-executor.ts
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import type { SceneAnimationTrack, SceneObject } from "@/shared/types/scene";
import { resolveInitialObject, type CanvasOverrides } from "@/shared/properties/resolver";

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

    const canvasOverrides: CanvasOverrides = {
      position: data.position as { x: number; y: number } | undefined,
      rotation: data.rotation as number | undefined,
      scale: data.scale as { x: number; y: number } | undefined,
      opacity: data.opacity as number | undefined,
      fillColor: data.fillColor as string | undefined,
      strokeColor: data.strokeColor as string | undefined,
      strokeWidth: data.strokeWidth as number | undefined,
    };

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const obj of inputData) {
        if (typeof obj === 'object' && obj !== null && 'id' in obj) {
          const original = obj as SceneObject as unknown as Record<string, unknown>;
          const { initialPosition, initialRotation, initialScale, initialOpacity, properties } = resolveInitialObject(
            original as unknown as SceneObject,
            canvasOverrides
          );

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