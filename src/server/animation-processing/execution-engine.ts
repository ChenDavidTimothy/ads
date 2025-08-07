// src/server/animation-processing/execution-engine.ts - Orchestrator engine (modular)
import type { NodeData } from "@/shared/types";
import type { ExecutionContext } from "./execution-context";
import { createExecutionContext, markNodeExecuted, isNodeExecuted } from "./execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "./types/graph";
import { ExecutorRegistry } from "./executors/node-executor";
import { GeometryNodeExecutor } from "./executors/geometry-executor";
import { TimingNodeExecutor } from "./executors/timing-executor";
import { LogicNodeExecutor } from "./executors/logic-executor";
import { AnimationNodeExecutor } from "./executors/animation-executor";
import { SceneNodeExecutor } from "./executors/scene-executor";
import { getTopologicalOrder } from "./graph/topo-sort";
import { validateScene, validateConnections, validateNoDuplicateObjectIds, validateProperFlow } from "./graph/validation";

export type { ReactFlowNode, ReactFlowEdge } from "./types/graph";
// Note: ExecutorRegistry remains internal; avoid leaking engine internals

export class ExecutionEngine {
  private registry: ExecutorRegistry = new ExecutorRegistry();

  constructor() {
    this.registry.register(new GeometryNodeExecutor());
    this.registry.register(new TimingNodeExecutor());
    this.registry.register(new LogicNodeExecutor());
    this.registry.register(new AnimationNodeExecutor());
    this.registry.register(new SceneNodeExecutor());
  }

  async executeFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): Promise<ExecutionContext> {
    validateScene(nodes);
    validateConnections(nodes, edges);
    validateProperFlow(nodes, edges);
    validateNoDuplicateObjectIds(nodes, edges);
    
    const context = createExecutionContext();
    
    // validateScene already ensures exactly one scene node exists
    
    const dataEdges = edges.filter((e) => (e.kind ?? 'data') === 'data');
    const executionOrder = getTopologicalOrder(nodes, dataEdges);
    
    for (const node of executionOrder) {
      if (!isNodeExecuted(context, node.data.identifier.id)) {
        const executor = this.registry.find(node.type ?? '');
        if (executor) {
          await executor.execute(node, context, edges);
          markNodeExecuted(context, node.data.identifier.id);
        }
      }
    }
    
    return context;
  }
}