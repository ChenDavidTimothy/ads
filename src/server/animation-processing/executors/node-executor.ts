// src/server/animation-processing/executors/node-executor.ts
import type { ExecutionContext } from '../execution-context';
import type { ReactFlowEdge, ReactFlowNode } from '../types/graph';
import type { NodeData } from '@/shared/types';

export interface NodeExecutor {
  canHandle(nodeType: string): boolean;
  execute(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void>;
}

export class ExecutorRegistry {
  private executors: NodeExecutor[] = [];

  register(executor: NodeExecutor): void {
    this.executors.push(executor);
  }

  find(nodeType: string): NodeExecutor | undefined {
    return this.executors.find((e) => e.canHandle(nodeType));
  }

  list(): NodeExecutor[] {
    return [...this.executors];
  }
}
