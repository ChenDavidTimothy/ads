// src/server/animation-processing/executors/base-executor.ts
import type { NodeExecutor } from "./node-executor";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import type { NodeData } from "@/shared/types";
import type { ExecutionContext } from "../execution-context";

// Type for executor methods
export type ExecutorMethod = (
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[],
) => Promise<void>;

// Base executor class with method registration pattern
export abstract class BaseExecutor implements NodeExecutor {
  protected handlers = new Map<string, ExecutorMethod>();

  constructor() {
    this.registerHandlers();
  }

  // Abstract method for subclasses to register their handlers
  protected abstract registerHandlers(): void;

  // Check if this executor can handle the node type (now uses method registration)
  canHandle(nodeType: string): boolean {
    return this.handlers.has(nodeType);
  }

  // Execute node using registered handler
  async execute(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const handler = this.handlers.get(node.type!);
    if (!handler) {
      throw new Error(
        `No handler registered for node type: ${node.type} in executor ${this.constructor.name}`,
      );
    }

    // Call the handler method with proper context
    await handler.call(this, node, context, connections);
  }

  // Helper method for registering handlers
  protected registerHandler(nodeType: string, method: ExecutorMethod): void {
    this.handlers.set(nodeType, method);
  }

  // Get all supported node types for this executor
  getSupportedNodeTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
