import type { ReactFlowNode, ReactFlowEdge } from '../types/graph';
import type { NodeData } from '@/shared/types/nodes';
import type { ExecutionContext } from '@/server/animation-processing/execution-context';
import { setNodeOutput } from '../execution-context';
import { BaseExecutor } from './base-executor';

export class ImageExecutor extends BaseExecutor {
  protected registerHandlers(): void {
    this.registerHandler('image', this.executeImage.bind(this));
  }

  private async executeImage(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    _edges: ReactFlowEdge[]
  ): Promise<void> {
    // Create basic image placeholder object
    const imageObject = {
      type: 'image' as const,
      id: `image_${node.data.identifier.id}`,
      // Basic properties only - no asset loading
      placeholder: true,
      nodeId: node.data.identifier.id,
      displayName: node.data.identifier.displayName
    };

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      [imageObject],
      { 
        perObjectTimeCursor: { [imageObject.id]: 0 }, 
        perObjectAssignments: {} 
      }
    );
  }
}

export const imageExecutor = new ImageExecutor();
