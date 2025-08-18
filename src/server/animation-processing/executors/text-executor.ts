import type { NodeExecutor } from "./node-executor";
import type { ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import type { NodeData, TextNodeData } from "@/shared/types";
import { setNodeOutput } from "../execution-context";
import { logger } from "@/lib/logger";

export class TextNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    return nodeType === 'text';
  }

  async execute(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    _connections: ReactFlowEdge[]
  ): Promise<void> {
    if (!this.canHandle(node.type!)) {
      throw new Error(`TextNodeExecutor cannot handle node type: ${node.type}`);
    }

    const data = node.data as TextNodeData;
    
    logger.info(`Creating text object: "${data.content}"`);
    
    const textObject = {
      id: data.identifier.id,
      type: 'text' as const,
      properties: {
        content: data.content,
        fontSize: data.fontSize
      },
      initialPosition: { x: 0, y: 0 },
      initialRotation: 0,
      initialScale: { x: 1, y: 1 },
      initialOpacity: 1,
    };

    setNodeOutput(
      context,
      data.identifier.id,
      'output',
      'object_stream',
      [textObject]
    );

    logger.info(`Text object created: ${data.identifier.displayName}`);
  }
}
