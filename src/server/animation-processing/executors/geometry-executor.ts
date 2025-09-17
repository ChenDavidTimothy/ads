// src/server/animation-processing/executors/geometry-executor.ts
import { UnknownNodeTypeError } from '@/shared/errors/domain';
import type { NodeData } from '@/shared/types';
import { setNodeOutput, type ExecutionContext } from '../execution-context';
import type { ReactFlowNode, ReactFlowEdge } from '../types/graph';
import { BaseExecutor } from './base-executor';

export class GeometryNodeExecutor extends BaseExecutor {
  // Register all geometry node handlers
  protected registerHandlers(): void {
    this.registerHandler('triangle', (node, context, connections) =>
      this.executeGeometry(node, context, connections)
    );
    this.registerHandler('circle', (node, context, connections) =>
      this.executeGeometry(node, context, connections)
    );
    this.registerHandler('rectangle', (node, context, connections) =>
      this.executeGeometry(node, context, connections)
    );
  }

  // Single method handles all geometry nodes
  private async executeGeometry(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    _connections: ReactFlowEdge[]
  ): Promise<void> {
    const objectDefinition = this.buildObjectDefinition(node);
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', [objectDefinition]);
  }

  private buildObjectDefinition(node: ReactFlowNode<NodeData>) {
    const data = node.data as unknown as Record<string, unknown>;
    const baseObject = {
      id: node.data.identifier.id,
      type: node.type as 'triangle' | 'circle' | 'rectangle',
      initialPosition: { x: 0, y: 0 }, // Default origin - Canvas will provide positioning
      initialRotation: 0,
      initialScale: { x: 1, y: 1 },
      initialOpacity: 1,
    };

    switch (node.type) {
      case 'triangle':
        return {
          ...baseObject,
          properties: {
            size: data.size as number,
          },
        };
      case 'circle':
        return {
          ...baseObject,
          properties: {
            radius: data.radius as number,
          },
        };
      case 'rectangle':
        return {
          ...baseObject,
          properties: {
            width: data.width as number,
            height: data.height as number,
          },
        };
      default:
        throw new UnknownNodeTypeError(String(node.type ?? 'unknown'));
    }
  }
}
