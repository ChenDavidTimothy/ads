// src/server/animation-processing/execution-engine.ts - Enhanced with comprehensive validation
import type { NodeData } from "@/shared/types";
import type { ExecutionContext } from "./execution-context";
import { createExecutionContext, markNodeExecuted, isNodeExecuted, getNodeOutput } from "./execution-context";
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
  validateNoDuplicateObjectIds,
  validateLogicNodePortConnections,
  validateBooleanTypeConnections,
  validateNumberTypeConnections
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

  private runComprehensiveValidation(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const flowKey = this.getFlowCacheKey(nodes, edges);
    const validationState = this.getValidationState(flowKey);
    
    logger.info('Starting comprehensive validation for video generation');
    
    // 1. Basic scene structure validation (VIDEO GENERATION ONLY) - only if not done
    if (!validationState.sceneValidated) {
      logger.info('Validating scene structure');
      validateScene(nodes);
      validationState.sceneValidated = true;
    } else {
      logger.debug('⚡ Skipping scene validation - already validated');
    }
    
    // 2. Run universal validations (will skip if already done)
    this.runUniversalValidation(nodes, edges);
    
    logger.info('All validation passed, proceeding with execution');
  }

  // Request-scoped validation state to prevent redundant validation
  private static validationStates = new Map<string, {
    universalValidated: boolean;
    sceneValidated: boolean;
    timestamp: number;
  }>();
  private static readonly VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getFlowCacheKey(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): string {
    // Generate deterministic key from flow structure
    const nodeIds = nodes.map(n => n.data.identifier.id).sort().join(',');
    const edgeIds = edges.map(e => `${e.source}->${e.target}`).sort().join(',');
    return `${nodeIds}|${edgeIds}`;
  }

  private static cleanupExpiredValidations(): void {
    const now = Date.now();
    for (const [key, state] of ExecutionEngine.validationStates.entries()) {
      if (now - state.timestamp > ExecutionEngine.VALIDATION_CACHE_TTL) {
        ExecutionEngine.validationStates.delete(key);
      }
    }
  }

  private getValidationState(flowKey: string) {
    ExecutionEngine.cleanupExpiredValidations();
    
    let state = ExecutionEngine.validationStates.get(flowKey);
    if (!state) {
      state = {
        universalValidated: false,
        sceneValidated: false,
        timestamp: Date.now()
      };
      ExecutionEngine.validationStates.set(flowKey, state);
    }
    return state;
  }

  public runUniversalValidation(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const flowKey = this.getFlowCacheKey(nodes, edges);
    const validationState = this.getValidationState(flowKey);
    
    // Skip if already validated for this flow structure
    if (validationState.universalValidated) {
      logger.debug('⚡ Skipping universal validation - already validated this flow structure');
      return;
    }

    logger.info('Starting universal validation (applies to all execution types)');
    
    // 1. Connection and port validation
    logger.info('Validating connections and ports');
    validateConnections(nodes, edges);
    
    // 2. Universal logic node port connections validation
    logger.info('Validating logic node port connections (prevents logical contradictions)');
    validateLogicNodePortConnections(nodes, edges);
    
    // 3. Boolean type validation (boolean operations and conditional logic)
    logger.info('Validating boolean input types for logic nodes');
    validateBooleanTypeConnections(nodes, edges);
    
    // 4. Number type validation (math operations and compare operations)
    logger.info('Validating number input types for numeric operations');
    validateNumberTypeConnections(nodes, edges);
    
    // 5. Flow architecture validation
    logger.info('Validating proper flow architecture');
    validateProperFlow(nodes, edges);
    
    // 6. Multiple insert nodes validation
    logger.info('Validating no multiple insert nodes in series');
    validateNoMultipleInsertNodesInSeries(nodes, edges);
    
    // 7. Duplicate object IDs validation (merge-aware)
    logger.info('Validating no duplicate object IDs');
    validateNoDuplicateObjectIds(nodes, edges);
    
    // Mark as validated
    validationState.universalValidated = true;
    
    logger.info('Universal validation passed');
  }

  async executeFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): Promise<ExecutionContext> {
    // Run comprehensive validation
    this.runComprehensiveValidation(nodes, edges);
    
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
        
        // Branch-aware gating: skip nodes whose required inputs are missing due to an unselected If/Else path
        if (shouldSkipDueToConditionalRouting(node, context, nodes, dataEdges)) {
          logger.info(`Skipping node due to conditional routing: ${node.data.identifier.displayName}`);
          continue;
        }

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
    // Calculate total objects across all scenes
    const totalObjects = Array.from(context.sceneObjectsByScene.values())
      .reduce((total, sceneObjects) => total + sceneObjects.length, 0);
    
    logger.info('Final context', { 
      objects: totalObjects, 
      animations: context.sceneAnimations.length,
      scenesWithObjects: context.sceneObjectsByScene.size
    });

    // Basic resource guardrails
    const maxAnimations = Number(process.env.MAX_ANIMATIONS_PER_EXECUTION ?? '100000');
    if (context.sceneAnimations.length > maxAnimations) {
      throw new Error(`Too many animations generated in a single execution: ${context.sceneAnimations.length} > ${maxAnimations}`);
    }
    
    return context;
  }

  async executeFlowDebug(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[], targetNodeId: string): Promise<ExecutionContext> {
    logger.debug(`Starting debug execution to node: ${targetNodeId}`);
    
    // Run only universal validation (no Scene requirement for debug)
    this.runUniversalValidation(nodes, edges);
    logger.debug(`Debug validation passed, target node ID: ${targetNodeId}`);
    
    // Create context with debug mode enabled
    const context = createExecutionContext();
    context.debugMode = true;
    context.debugTargetNodeId = targetNodeId; // Set specific debug target for selective logging
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
        
        // Branch-aware gating: skip nodes whose required inputs are missing due to an unselected If/Else path
        if (shouldSkipDueToConditionalRouting(node, context, nodes, dataEdges)) {
          logger.debug(`Skipping node due to conditional routing: ${node.data.identifier.displayName}`);
          continue;
        }

        const executor = this.registry.find(node.type ?? '');
        if (executor) {
          await executor.execute(node, context, edges);
          markNodeExecuted(context, node.data.identifier.id);
          logger.debug(`Completed node: ${node.data.identifier.displayName}`);
          
          // Debug: Check if this is the target node and if logs were generated
          if (node.data.identifier.id === targetNodeId) {
            logger.debug(`Target node executed! Debug logs count: ${context.executionLog?.length || 0}`);
            logger.debug(`Context debug mode: ${context.debugMode}, target ID: ${context.debugTargetNodeId}`);
          }
        } else {
          logger.warn(`Debug: No executor found for node type: ${node.type}`);
        }
      } else {
        logger.debug(`Skipping already executed node: ${node.data.identifier.displayName}`);
      }
    }
    
    logger.debug(`Debug execution completed at target node: ${targetNodeId}`);
    logger.debug('Debug logs generated', { 
      count: context.executionLog?.length || 0,
      logs: context.executionLog?.map(log => ({ 
        nodeId: log.nodeId, 
        type: (log.data as { type?: string })?.type 
      })) || []
    });
    
    return context;
  }
}

// Determine if a node should be skipped because its required inputs are connected to an If/Else branch that was not selected
function shouldSkipDueToConditionalRouting(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  allNodes: ReactFlowNode<NodeData>[],
  edges: ReactFlowEdge[]
): boolean {
  // Build a quick map for node lookup by id
  const nodeById = new Map(allNodes.map((n) => [n.data.identifier.id, n] as const));

  // Group incoming edges by target port (only data edges)
  const incomingByPort = new Map<string, ReactFlowEdge[]>();
  for (const e of edges) {
    if (e.target !== node.data.identifier.id || !e.targetHandle) continue;
    const arr = incomingByPort.get(e.targetHandle) ?? [];
    arr.push(e);
    incomingByPort.set(e.targetHandle, arr);
  }

  // If no incoming edges at all, do not skip here (let normal logic handle unconnected cases)
  if (incomingByPort.size === 0) return false;

  // If ANY connected input port has only if_else branch sources and none produced a value, skip the node
  for (const incomingEdges of incomingByPort.values()) {
    // If port has no connections, ignore
    if (!incomingEdges.length) continue;

    // If any edge produced a value, this port is satisfied
    let anyValuePresent = false;
    for (const edge of incomingEdges) {
      const val = getNodeOutput(context, edge.source, edge.sourceHandle ?? '');
      if (val !== undefined) {
        anyValuePresent = true;
        break;
      }
    }
    if (anyValuePresent) continue;

    // No value present for this port: check if all sources are unselected if_else branches
    let allSourcesAreIfElseBranches = true;
    for (const edge of incomingEdges) {
      const src = nodeById.get(edge.source);
      const isIfElseBranch = src?.type === 'if_else' && (edge.sourceHandle === 'true_path' || edge.sourceHandle === 'false_path');
      if (!isIfElseBranch) {
        allSourcesAreIfElseBranches = false;
        break;
      }
    }

    if (allSourcesAreIfElseBranches) {
      // This input port is unsatisfied solely because the connected if_else branch(es) did not emit → skip node
      return true;
    }
  }

  return false;
}