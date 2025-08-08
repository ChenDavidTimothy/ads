// src/server/animation-processing/execution-engine.ts - Enhanced with comprehensive validation
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
import { 
  validateScene, 
  validateConnections, 
  validateProperFlow, 
  validateNoMultipleInsertNodesInSeries,
  validateNoDuplicateObjectIds 
} from "./graph/validation";

export type { ReactFlowNode, ReactFlowEdge } from "./types/graph";

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
    // Comprehensive validation in correct order
    console.log('[EXECUTION] Starting comprehensive validation');
    
    // 1. Basic scene structure validation
    console.log('[EXECUTION] Validating scene structure');
    validateScene(nodes);
    
    // 2. Connection and port validation (includes new merge port validation)
    console.log('[EXECUTION] Validating connections and ports');
    validateConnections(nodes, edges);
    
    // 3. Flow architecture validation
    console.log('[EXECUTION] Validating proper flow architecture');
    validateProperFlow(nodes, edges);
    
    // 4. Multiple insert nodes validation
    console.log('[EXECUTION] Validating no multiple insert nodes in series');
    validateNoMultipleInsertNodesInSeries(nodes, edges);
    
    // 5. Duplicate object IDs validation (merge-aware)
    console.log('[EXECUTION] Validating no duplicate object IDs');
    validateNoDuplicateObjectIds(nodes, edges);
    
    console.log('[EXECUTION] All validation passed, proceeding with execution');
    
    const context = createExecutionContext();
    
    // Filter to data edges only for execution ordering
    const dataEdges = edges.filter((e) => (e.kind ?? 'data') === 'data');
    const executionOrder = getTopologicalOrder(nodes, dataEdges);
    
    console.log('[EXECUTION] Execution order:', executionOrder.map(n => ({
      id: n.data.identifier.id,
      type: n.type,
      displayName: n.data.identifier.displayName
    })));
    
    // Execute nodes in topological order
    for (const node of executionOrder) {
      if (!isNodeExecuted(context, node.data.identifier.id)) {
        console.log(`[EXECUTION] Executing node: ${node.data.identifier.displayName} (${node.type})`);
        
        const executor = this.registry.find(node.type ?? '');
        if (executor) {
          await executor.execute(node, context, edges);
          markNodeExecuted(context, node.data.identifier.id);
          console.log(`[EXECUTION] Completed node: ${node.data.identifier.displayName}`);
        } else {
          console.warn(`[EXECUTION] No executor found for node type: ${node.type}`);
        }
      } else {
        console.log(`[EXECUTION] Skipping already executed node: ${node.data.identifier.displayName}`);
      }
    }
    
    console.log('[EXECUTION] Flow execution completed');
    console.log(`[EXECUTION] Final context - Objects: ${context.sceneObjects.length}, Animations: ${context.sceneAnimations.length}`);
    
    return context;
  }
}