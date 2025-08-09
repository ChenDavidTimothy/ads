// src/server/animation-processing/executors/scene-executor.ts
import type { NodeData } from "@/shared/types";
import { getConnectedInputs, type ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { MissingInsertConnectionError } from "@/shared/errors/domain";

export class SceneNodeExecutor extends BaseExecutor {
  // Register scene node handlers
  protected registerHandlers(): void {
    this.registerHandler('scene', (node, context, connections) => this.executeScene(node, context, connections));
  }



  private async executeScene(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const item of inputData) {
        if (typeof item === 'object' && item !== null && 'id' in item && 'appearanceTime' in item) {
          context.sceneObjects.push(item as never);
        }
      }
    }

    if (context.sceneObjects.length === 0) {
      throw new MissingInsertConnectionError(node.data.identifier.displayName, node.data.identifier.id);
    }
  }
}


