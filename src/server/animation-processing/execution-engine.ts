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
import { logger } from "@/lib/logger";

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
    logger.info('Starting comprehensive validation');
    
    // 1. Basic scene structure validation
    logger.info('Validating scene structure');
    validateScene(nodes);
    
    // 2. Connection and port validation (includes new merge port validation)
    logger.info('Validating connections and ports');
    validateConnections(nodes, edges);
    
    // 3. Flow architecture validation
    logger.info('Validating proper flow architecture');
    validateProperFlow(nodes, edges);
    
    // 4. Multiple insert nodes validation
    logger.info('Validating no multiple insert nodes in series');
    validateNoMultipleInsertNodesInSeries(nodes, edges);
    
    // 5. Duplicate object IDs validation (merge-aware)
    logger.info('Validating no duplicate object IDs');
    validateNoDuplicateObjectIds(nodes, edges);
    
    logger.info('All validation passed, proceeding with execution');
    
    const context = createExecutionContext();
    
    // Filter to data edges only for execution ordering
    const dataEdges = edges.filter((e) => (e.kind ?? 'data') === 'data');
    const executionOrder = getTopologicalOrder(nodes, dataEdges);
    
    logger.info('Execution order', { executionOrder: executionOrder.map(n => ({
      id: n.data.identifier.id,
      type: n.type,
      displayName: n.data.identifier.displayName
    })) });
    
    // Execute nodes in topological order
    for (const node of executionOrder) {
      if (!isNodeExecuted(context, node.data.identifier.id)) {
        logger.info(`Executing node: ${node.data.identifier.displayName} (${node.type})`);
        
        const executor = this.registry.find(node.type ?? '');
        if (executor) {
          await executor.execute(node, context, edges);
          markNodeExecuted(context, node.data.identifier.id);
          logger.info(`Completed node: ${node.data.identifier.displayName}`);
        } else {
          logger.warn(`No executor found for node type: ${node.type}`);
        }
      } else {
        logger.info(`Skipping already executed node: ${node.data.identifier.displayName}`);
      }
    }
    
    logger.info('Flow execution completed');
    logger.info('Final context', { objects: context.sceneObjects.length, animations: context.sceneAnimations.length });
    
    return context;
  }

  async executeFlowDebug(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[], targetNodeId: string): Promise<ExecutionContext> {
    logger.debug(`Starting debug execution to node: ${targetNodeId}`);
    
    // Create context with debug mode enabled
    const context = createExecutionContext();
    context.debugMode = true;
    context.executionLog = [];
    
    // Filter to data edges only for execution ordering
    const dataEdges = edges.filter((e) => (e.kind ?? 'data') === 'data');
    const executionOrder = getTopologicalOrder(nodes, dataEdges);
    
    // Find the target node in the execution order
    const targetNodeIndex = executionOrder.findIndex(n => n.data.identifier.id === targetNodeId);
    if (targetNodeIndex === -1) {
      throw new Error(`Target node ${targetNodeId} not found in execution order`);
    }
    
    // Execute only up to and including the target node
    const nodesToExecute = executionOrder.slice(0, targetNodeIndex + 1);
    
    logger.debug(`Will execute ${nodesToExecute.length} nodes up to target`, { nodes: nodesToExecute.map(n => ({
      id: n.data.identifier.id,
      type: n.type,
      displayName: n.data.identifier.displayName
    })) });
    
    // Execute nodes in topological order up to target
    for (const node of nodesToExecute) {
      if (!isNodeExecuted(context, node.data.identifier.id)) {
        logger.debug(`Executing node: ${node.data.identifier.displayName} (${node.type})`);
        
        const executor = this.registry.find(node.type ?? '');
        if (executor) {
          await executor.execute(node, context, edges);
          markNodeExecuted(context, node.data.identifier.id);
          logger.debug(`Completed node: ${node.data.identifier.displayName}`);
        } else {
          logger.warn(`Debug: No executor found for node type: ${node.type}`);
        }
      } else {
        logger.debug(`Skipping already executed node: ${node.data.identifier.displayName}`);
      }
    }
    
    logger.debug(`Debug execution completed at target node: ${targetNodeId}`);
    logger.debug('Debug logs generated', { count: context.executionLog?.length || 0 });
    
    return context;
  }
}