// src/server/animation-processing/execution-engine.ts - Future-ready execution engine
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import type { ExecutionContext, ExecutionResult } from "./execution-context";
import { 
  createExecutionContext, 
  setNodeOutput, 
  getConnectedInputs,
  markNodeExecuted,
  isNodeExecuted,
  shouldContinueExecution,
  setConditionalPath,
  enableDebugMode,
  getExecutionMetrics
} from "./execution-context";
import { getNodeDefinition, getNodesByCategory, getNodesByExecutor } from "@/shared/types/definitions";

// ReactFlow-compatible types for server
export interface ReactFlowNode<T = unknown> {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: T;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// Enhanced node executor interface for visual programming
export interface NodeExecutor {
  canHandle(nodeType: string): boolean;
  execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult>;
  
  // Future: Support for conditional execution
  shouldExecute?(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<boolean>;
  
  // Future: Support for parallel execution
  canExecuteInParallel?(nodeType: string): boolean;
}

// Enhanced Geometry node executor
class GeometryNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const nodeDefinition = getNodeDefinition(nodeType);
    return nodeDefinition?.execution.executor === 'geometry';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const objectDefinition = this.buildObjectDefinition(node);
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', [objectDefinition]);
    
    return { success: true, data: [objectDefinition] };
  }

  private buildObjectDefinition(node: ReactFlowNode<NodeData>) {
    const data = node.data as Record<string, unknown>;
    const baseObject = {
      id: node.data.identifier.id,
      type: node.type as "triangle" | "circle" | "rectangle",
      initialPosition: data.position as { x: number; y: number },
      initialRotation: 0,
      initialScale: { x: 1, y: 1 },
      initialOpacity: 1,
    };

    switch (node.type) {
      case "triangle":
        return {
          ...baseObject,
          properties: {
            size: data.size as number,
            color: data.color as string,
            strokeColor: data.strokeColor as string,
            strokeWidth: data.strokeWidth as number,
          },
        };
      case "circle":
        return {
          ...baseObject,
          properties: {
            radius: data.radius as number,
            color: data.color as string,
            strokeColor: data.strokeColor as string,
            strokeWidth: data.strokeWidth as number,
          },
        };
      case "rectangle":
        return {
          ...baseObject,
          properties: {
            width: data.width as number,
            height: data.height as number,
            color: data.color as string,
            strokeColor: data.strokeColor as string,
            strokeWidth: data.strokeWidth as number,
          },
        };
      default:
        throw new Error(`Unknown geometry type: ${node.type}`);
    }
  }

  // Future: Parallel execution support for geometry nodes
  canExecuteInParallel(): boolean {
    return true; // Geometry nodes can be created in parallel
  }
}

// Enhanced Timing node executor
class TimingNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const nodeDefinition = getNodeDefinition(nodeType);
    return nodeDefinition?.execution.executor === 'timing';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const data = node.data as Record<string, unknown>;
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    const timedObjects = [];
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const objectDef of inputData) {
        const timedObject = {
          ...objectDef,
          appearanceTime: data.appearanceTime as number
        };

        timedObjects.push(timedObject);
      }
    }

    context.currentTime = Math.max(context.currentTime, data.appearanceTime as number);
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', timedObjects);
    
    return { success: true, data: timedObjects };
  }
}

// Enhanced Logic node executor with future conditional support
class LogicNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const nodeDefinition = getNodeDefinition(nodeType);
    return nodeDefinition?.execution.executor === 'logic';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    // Route to specific logic node handler based on type
    switch (node.type) {
      case 'filter':
        return await this.executeFilter(node, context, connections);
      // Future logic nodes will be handled here
      case 'if_else':
        return await this.executeIfElse(node, context, connections);
      case 'switch':
        return await this.executeSwitch(node, context, connections);
      case 'comparison':
        return await this.executeComparison(node, context, connections);
      default:
        return { success: false, error: `Unknown logic node type: ${node.type}` };
    }
  }

  private async executeFilter(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const data = node.data as Record<string, unknown>;
    const selectedObjectIds = (data.selectedObjectIds as string[]) || [];
    
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    if (inputs.length === 0) {
      setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', []);
      return { success: true, data: [] };
    }
    
    const filteredResults = [];
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const item of inputData) {
        if (this.hasFilterableObjects(item)) {
          const filtered = this.filterItem(item, selectedObjectIds);
          if (filtered) {
            filteredResults.push(filtered);
          }
        } else {
          filteredResults.push(item);
        }
      }
    }
    
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', filteredResults);
    return { success: true, data: filteredResults };
  }

  // Future: If/Else conditional execution
  private async executeIfElse(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const data = node.data as Record<string, unknown>;
    const conditionInput = getConnectedInputs(context, connections, node.data.identifier.id, 'condition')[0];
    
    if (!conditionInput) {
      return { success: false, error: "No condition input provided" };
    }
    
    const conditionValue = Boolean(conditionInput.data);
    const outputPort = conditionValue ? 'true_output' : 'false_output';
    
    setConditionalPath(context, node.data.identifier.id, conditionValue ? 'true' : 'false');
    
    // Get input data and pass it through the appropriate output
    const dataInput = getConnectedInputs(context, connections, node.data.identifier.id, 'input')[0];
    const outputData = dataInput?.data ?? null;
    
    setNodeOutput(context, node.data.identifier.id, outputPort, 'object_stream', outputData);
    
    return { 
      success: true, 
      data: outputData,
      nextPort: outputPort,
      conditionalOutputs: { [outputPort]: outputData }
    };
  }

  // Future: Switch case execution
  private async executeSwitch(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const data = node.data as Record<string, unknown>;
    const switchInput = getConnectedInputs(context, connections, node.data.identifier.id, 'switch_value')[0];
    
    if (!switchInput) {
      return { success: false, error: "No switch value provided" };
    }
    
    const switchValue = String(switchInput.data);
    const cases = (data.cases as Array<{ value: string; output: string }>) || [];
    
    // Find matching case or use default
    const matchingCase = cases.find(c => c.value === switchValue);
    const outputPort = matchingCase?.output || 'default_output';
    
    setConditionalPath(context, node.data.identifier.id, 'default');
    
    const dataInput = getConnectedInputs(context, connections, node.data.identifier.id, 'input')[0];
    const outputData = dataInput?.data ?? null;
    
    setNodeOutput(context, node.data.identifier.id, outputPort, 'object_stream', outputData);
    
    return { 
      success: true, 
      data: outputData,
      nextPort: outputPort,
      conditionalOutputs: { [outputPort]: outputData }
    };
  }

  // Future: Comparison operations
  private async executeComparison(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const data = node.data as Record<string, unknown>;
    const operation = data.operation as string;
    
    const inputA = getConnectedInputs(context, connections, node.data.identifier.id, 'input_a')[0];
    const inputB = getConnectedInputs(context, connections, node.data.identifier.id, 'input_b')[0];
    
    if (!inputA || !inputB) {
      return { success: false, error: "Missing comparison inputs" };
    }
    
    let result = false;
    const valueA = inputA.data;
    const valueB = inputB.data;
    
    switch (operation) {
      case 'equals':
        result = valueA === valueB;
        break;
      case 'not_equals':
        result = valueA !== valueB;
        break;
      case 'greater_than':
        result = Number(valueA) > Number(valueB);
        break;
      case 'less_than':
        result = Number(valueA) < Number(valueB);
        break;
      default:
        return { success: false, error: `Unknown comparison operation: ${operation}` };
    }
    
    setNodeOutput(context, node.data.identifier.id, 'result', 'boolean', result);
    return { success: true, data: result };
  }

  private hasFilterableObjects(item: unknown): boolean {
    return typeof item === 'object' && item !== null && 'id' in item;
  }

  private filterItem(item: unknown, selectedObjectIds: string[]): unknown | null {
    if (typeof item === 'object' && item !== null && 'id' in item) {
      const objectId = (item as { id: string }).id;
      return selectedObjectIds.includes(objectId) ? item : null;
    }
    
    return item;
  }
}

// Enhanced Animation node executor
class AnimationNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const nodeDefinition = getNodeDefinition(nodeType);
    return nodeDefinition?.execution.executor === 'animation';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    const allAnimations: SceneAnimationTrack[] = [];
    const passThroughObjects: unknown[] = [];
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const timedObject of inputData) {
        const objectStartTime = timedObject.appearanceTime || 0;
        const animations = this.convertTracksToSceneAnimations(
          (data.tracks as AnimationTrack[]) || [],
          timedObject.id,
          objectStartTime
        );
        allAnimations.push(...animations);
        passThroughObjects.push(timedObject);
      }
    }

    context.sceneAnimations.push(...allAnimations);
    const maxDuration = allAnimations.length > 0 ? 
      Math.max(...allAnimations.map(a => a.startTime + a.duration), context.currentTime) : 
      context.currentTime;
    context.currentTime = maxDuration;

    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', passThroughObjects);
    return { success: true, data: passThroughObjects };
  }

  private convertTracksToSceneAnimations(tracks: AnimationTrack[], objectId: string, objectStartTime: number): SceneAnimationTrack[] {
    return tracks.map((track): SceneAnimationTrack => {
      switch (track.type) {
        case 'move':
          return {
            objectId,
            type: 'move',
            startTime: objectStartTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
            }
          };
        case 'rotate':
          return {
            objectId,
            type: 'rotate',
            startTime: objectStartTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: 0,
              to: 0,
              rotations: track.properties.rotations,
            }
          };
        case 'scale':
          return {
            objectId,
            type: 'scale',
            startTime: objectStartTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
            }
          };
        case 'fade':
          return {
            objectId,
            type: 'fade',
            startTime: objectStartTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
            }
          };
        case 'color':
          return {
            objectId,
            type: 'color',
            startTime: objectStartTime + track.startTime,
            duration: track.duration,
            easing: track.easing,
            properties: {
              from: track.properties.from,
              to: track.properties.to,
              property: track.properties.property,
            }
          };
        default:
          throw new Error(`Unknown track type: ${track.type}`);
      }
    });
  }
}

// Enhanced Scene node executor
class SceneNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const nodeDefinition = getNodeDefinition(nodeType);
    return nodeDefinition?.execution.executor === 'scene';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const inputs = getConnectedInputs(context, connections, node.data.identifier.id, 'input');
    
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const item of inputData) {
        if (typeof item === 'object' && item !== null && 'id' in item && 'appearanceTime' in item) {
          context.sceneObjects.push(item);
        }
      }
    }
    
    if (context.sceneObjects.length === 0) {
      return { 
        success: false, 
        error: `Scene ${node.data.identifier.displayName} has no reachable objects. Connect object flows: Geometry → Insert → Animation → Scene` 
      };
    }
    
    return { success: true, data: context.sceneObjects };
  }
}

// Future: Data source executor for variables and constants
class DataSourceNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const nodeDefinition = getNodeDefinition(nodeType);
    return nodeDefinition?.execution.executor === 'data';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    const data = node.data as Record<string, unknown>;
    
    switch (node.type) {
      case 'variable':
        const variableName = data.variableName as string;
        const variableValue = context.variables.get(variableName);
        setNodeOutput(context, node.data.identifier.id, 'output', 'any', variableValue);
        return { success: true, data: variableValue };
        
      case 'constant':
        const constantValue = data.value;
        const constantType = data.type as string;
        setNodeOutput(context, node.data.identifier.id, 'output', constantType as PortType, constantValue);
        return { success: true, data: constantValue };
        
      default:
        return { success: false, error: `Unknown data source type: ${node.type}` };
    }
  }

  canExecuteInParallel(): boolean {
    return true; // Data sources can execute in parallel
  }
}

// Future: Control flow executor for loops and functions
class ControlFlowNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const nodeDefinition = getNodeDefinition(nodeType);
    return nodeDefinition?.execution.executor === 'control_flow';
  }

  async execute(
    node: ReactFlowNode<NodeData>, 
    context: ExecutionContext, 
    connections: ReactFlowEdge[]
  ): Promise<ExecutionResult> {
    if (!shouldContinueExecution(context, node.data.identifier.id)) {
      return { success: false, error: "Node execution skipped" };
    }

    // Future implementation for for loops, while loops, functions, etc.
    return { success: false, error: "Control flow nodes not yet implemented" };
  }
}

// Enhanced execution engine with visual programming support
export class ExecutionEngine {
  private executors: NodeExecutor[] = [
    new GeometryNodeExecutor(),
    new TimingNodeExecutor(),
    new LogicNodeExecutor(),
    new AnimationNodeExecutor(),
    new SceneNodeExecutor(),
    // Future executors
    new DataSourceNodeExecutor(),
    new ControlFlowNodeExecutor()
  ];

  async executeFlow(
    nodes: ReactFlowNode<NodeData>[], 
    edges: ReactFlowEdge[],
    options?: {
      debugMode?: boolean;
      parallelExecution?: boolean;
      maxExecutionTime?: number;
    }
  ): Promise<ExecutionContext> {
    this.validateScene(nodes);
    this.validateConnections(nodes, edges);
    this.validateProperFlow(nodes, edges);
    this.validateNoDuplicateObjectIds(nodes, edges);
    
    const context = createExecutionContext();
    
    // Enable debug mode if requested
    if (options?.debugMode) {
      enableDebugMode(context);
    }
    
    // Set execution metrics
    if (context.executionMetrics) {
      context.executionMetrics.totalNodes = nodes.length;
    }
    
    const sceneNode = nodes.find(n => n.type === 'scene');
    if (!sceneNode) {
      throw new Error("Scene node is required");
    }
    
    const executionOrder = this.getTopologicalOrder(nodes, edges);
    
    // Execute nodes in order (future: support parallel execution)
    for (const node of executionOrder) {
      if (!isNodeExecuted(context, node.data.identifier.id)) {
        const executor = this.getExecutor(node.type!);
        if (executor) {
          try {
            const result = await executor.execute(node, context, edges);
            if (result.success) {
              markNodeExecuted(context, node.data.identifier.id);
            } else {
              console.warn(`Node execution failed: ${node.data.identifier.displayName} - ${result.error}`);
              if (context.executionMetrics) {
                context.executionMetrics.skippedNodes++;
              }
            }
          } catch (error) {
            console.error(`Node execution error: ${node.data.identifier.displayName}`, error);
            if (context.executionMetrics) {
              context.executionMetrics.skippedNodes++;
            }
          }
        }
      }
    }
    
    // Log execution metrics if debug mode enabled
    if (options?.debugMode && context.executionMetrics) {
      const metrics = getExecutionMetrics(context);
      console.log('Execution completed:', metrics);
    }
    
    return context;
  }

  // Current validation methods (preserved)
  private validateNoDuplicateObjectIds(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const geometryNodes = getNodesByCategory('geometry');
    const geometryNodeTypes = geometryNodes.map(def => def.type);
    
    for (const targetNode of nodes) {
      if (geometryNodeTypes.includes(targetNode.type!) || targetNode.type === 'merge') {
        continue;
      }

      const incomingObjectIds = this.getIncomingObjectIds(targetNode.data.identifier.id, edges, nodes);
      const duplicates = incomingObjectIds.filter((id, index) => 
        incomingObjectIds.indexOf(id) !== index
      );
      
      if (duplicates.length > 0) {
        throw new Error(
          `Node ${targetNode.data.identifier.displayName} receives duplicate object IDs: ${duplicates.join(', ')}. ` +
          `Each node can only receive each object once. Use Merge node to explicitly handle duplicate objects.`
        );
      }
    }
  }

  private getIncomingObjectIds(targetNodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): string[] {
    const geometryNodes: ReactFlowNode<NodeData>[] = [];
    const visited = new Set<string>();
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    
    const traceUpstream = (currentNodeId: string): void => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (!currentNode) return;
      
      if (geometryNodeTypes.includes(currentNode.type!)) {
        geometryNodes.push(currentNode);
        return;
      }
      
      const incomingEdges = edges.filter(edge => edge.target === currentNodeId);
      for (const edge of incomingEdges) {
        traceUpstream(edge.source);
      }
    };
    
    traceUpstream(targetNodeId);
    return geometryNodes.map(node => node.data.identifier.id);
  }

  private validateProperFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    const geometryNodes = nodes.filter(n => geometryNodeTypes.includes(n.type!));
    
    for (const geoNode of geometryNodes) {
      const isConnectedToScene = this.isNodeConnectedToScene(geoNode.data.identifier.id, edges, nodes);
      
      if (isConnectedToScene) {
        const canReachInsert = this.canReachNodeType(geoNode.data.identifier.id, 'insert', edges, nodes);
        
        if (!canReachInsert) {
          throw new Error(
            `Geometry node ${geoNode.data.identifier.displayName} must connect to an Insert node ` +
            `(directly or through Filter nodes) to appear in the scene. Insert nodes control when objects appear in the timeline.`
          );
        }
      }
    }
  }

  private canReachNodeType(
    startNodeId: string, 
    targetNodeType: string, 
    edges: ReactFlowEdge[], 
    nodes: ReactFlowNode<NodeData>[]
  ): boolean {
    const visited = new Set<string>();
    
    const traverse = (currentNodeId: string): boolean => {
      if (visited.has(currentNodeId)) return false;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (currentNode?.type === targetNodeType) return true;
      
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      return outgoingEdges.some(edge => traverse(edge.target));
    };
    
    return traverse(startNodeId);
  }

  private isNodeConnectedToScene(nodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): boolean {
    const visited = new Set<string>();
    
    const traverse = (currentNodeId: string): boolean => {
      if (visited.has(currentNodeId)) return false;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (currentNode?.type === 'scene') return true;
      
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      return outgoingEdges.some(edge => traverse(edge.target));
    };
    
    return traverse(nodeId);
  }

  private getTopologicalOrder(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): ReactFlowNode<NodeData>[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    
    for (const node of nodes) {
      inDegree.set(node.data.identifier.id, 0);
      adjList.set(node.data.identifier.id, []);
    }
    
    for (const edge of edges) {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    
    const queue: ReactFlowNode<NodeData>[] = [];
    const result: ReactFlowNode<NodeData>[] = [];
    
    for (const node of nodes) {
      if (inDegree.get(node.data.identifier.id) === 0) {
        queue.push(node);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      for (const neighborId of adjList.get(current.data.identifier.id) ?? []) {
        const newInDegree = (inDegree.get(neighborId) ?? 1) - 1;
        inDegree.set(neighborId, newInDegree);
        
        if (newInDegree === 0) {
          const neighborNode = nodes.find(n => n.data.identifier.id === neighborId);
          if (neighborNode) {
            queue.push(neighborNode);
          }
        }
      }
    }
    
    if (result.length !== nodes.length) {
      throw new Error("Circular dependency detected in node graph");
    }
    
    return result;
  }

  private validateConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
    const objectToInsertMap = new Map<string, string>();
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    
    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.data.identifier.id === edge.source);
      const targetNode = nodes.find(n => n.data.identifier.id === edge.target);
      
      if (!sourceNode || !targetNode) continue;
      
      if (geometryNodeTypes.includes(sourceNode.type!) && targetNode.type === 'insert') {
        const existingInsert = objectToInsertMap.get(sourceNode.data.identifier.id);
        if (existingInsert && existingInsert !== targetNode.data.identifier.id) {
          throw new Error(
            `Object ${sourceNode.data.identifier.displayName} cannot connect to multiple Insert nodes. ` +
            `Already connected to ${existingInsert}, attempted connection to ${targetNode.data.identifier.id}.`
          );
        }
        objectToInsertMap.set(sourceNode.data.identifier.id, targetNode.data.identifier.id);
      }
    }
  }

  private validateScene(nodes: ReactFlowNode<NodeData>[]): void {
    const sceneNodes = nodes.filter(node => node.type === "scene");
    
    if (sceneNodes.length === 0) {
      throw new Error("Scene node is required");
    }
    
    if (sceneNodes.length > 1) {
      throw new Error("Only one scene node allowed per workspace");
    }
  }

  private getExecutor(nodeType: string): NodeExecutor | undefined {
    return this.executors.find(executor => executor.canHandle(nodeType));
  }

  addExecutor(executor: NodeExecutor): void {
    this.executors.push(executor);
  }

  // Future: Parallel execution support
  private async executeInParallel(
    nodes: ReactFlowNode<NodeData>[],
    context: ExecutionContext,
    edges: ReactFlowEdge[]
  ): Promise<void> {
    const parallelGroups = this.groupNodesForParallelExecution(nodes, edges);
    
    for (const group of parallelGroups) {
      const promises = group.map(async (node) => {
        const executor = this.getExecutor(node.type!);
        if (executor && !isNodeExecuted(context, node.data.identifier.id)) {
          try {
            const result = await executor.execute(node, context, edges);
            if (result.success) {
              markNodeExecuted(context, node.data.identifier.id);
            }
          } catch (error) {
            console.error(`Parallel execution error for ${node.data.identifier.displayName}:`, error);
          }
        }
      });
      
      await Promise.all(promises);
    }
  }

  // Future: Group nodes that can execute in parallel
  private groupNodesForParallelExecution(
    nodes: ReactFlowNode<NodeData>[],
    edges: ReactFlowEdge[]
  ): ReactFlowNode<NodeData>[][] {
    // Implementation would analyze dependencies and group nodes that can execute in parallel
    // For now, return single groups (sequential execution)
    return nodes.map(node => [node]);
  }
}