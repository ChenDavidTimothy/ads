// src/server/animation-processing/executors/logic-executor.ts
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, getTypedConnectedInput, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { extractObjectIdsFromInputs, isPerObjectCursorMap, mergeCursorMaps, pickCursorsForIds } from "../scene/scene-assembler";
import { TypeValidationError } from "@/shared/types/validation";
import { logger } from "@/lib/logger";

export class LogicNodeExecutor extends BaseExecutor {
  // Register all logic node handlers
  protected registerHandlers(): void {
    this.registerHandler('filter', this.executeFilter.bind(this));
    this.registerHandler('merge', this.executeMerge.bind(this));
    this.registerHandler('constants', this.executeConstants.bind(this));
    this.registerHandler('print', this.executePrint.bind(this));
    this.registerHandler('compare', this.executeCompare.bind(this));
    this.registerHandler('if_else', this.executeIfElse.bind(this));
    this.registerHandler('boolean_op', this.executeBooleanOp.bind(this));
    this.registerHandler('math_op', this.executeMathOp.bind(this));
  }



  private async executeConstants(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    _connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const valueType = data.valueType as string;
    
    let outputValue: unknown;
    let logicType: string;
    
    switch (valueType) {
      case 'number':
        outputValue = Number(data.numberValue);
        logicType = 'number';
        break;
      case 'string':
        outputValue = typeof data.stringValue === 'string' ? data.stringValue : (data.stringValue ?? '');
        logicType = 'string';
        break;
      case 'boolean':
        outputValue = (data.booleanValue as string) === 'true';
        logicType = 'boolean';
        break;
      case 'color':
        outputValue = typeof data.colorValue === 'string' ? data.colorValue : (data.colorValue ?? '#ffffff');
        logicType = 'color';
        break;
      default:
        outputValue = 0;
        logicType = 'number';
        logger.warn(`Unknown value type: ${valueType}, defaulting to number 0`);
    }

    logger.debug(`Constants ${node.data.identifier.displayName}: ${valueType} = ${String(outputValue)}`);
    
    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'data',
      outputValue,
      { logicType, validated: true }
    );
  }

  private async executePrint(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const label = typeof data.label === 'string' ? data.label : 'Debug';
    const nodeDisplayName = node.data.identifier?.displayName || 'Print Node';
    
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    if (inputs.length === 0) {
      const noInputMessage = '<no input connected>';
      logger.info(`[PRINT] ${label}: ${noInputMessage}`);
      
      // Only capture debug logs if this node is the debug target
      const isDebugTarget = context.debugTargetNodeId === node.data.identifier.id;
      
      // Store "no input" state for production debugging
      if (context.debugMode && context.executionLog && isDebugTarget) {
        context.executionLog.push({
          nodeId: node.data.identifier.id,
          timestamp: Date.now(),
          action: 'execute',
          data: {
            type: 'print_output',
            label,
            nodeDisplayName,
            value: null,
            valueType: 'no_input',
            formattedValue: noInputMessage,
            executionContext: {
              hasConnections: false,
              inputCount: 0,
              executionId: `exec-${Date.now()}`,
              flowState: 'no_input_connected'
            }
          }
        });
      }
      return;
    }

    // Process all connected inputs with enhanced production logging
    for (const [inputIndex, input] of inputs.entries()) {
      const value = input.data;
      const valueType = this.getValueType(value);
      const formattedValue = this.formatValue(value);
      const executionId = `exec-${Date.now()}-${inputIndex}`;
      
      // Enhanced console logging for development
      logger.info(`[PRINT] ${label}: ${formattedValue} (${valueType})`);
      
      // Only capture debug logs if this node is the debug target
      const isDebugTarget = context.debugTargetNodeId === node.data.identifier.id;
      
      // Production-ready debug storage with comprehensive metadata
      if (context.debugMode && context.executionLog && isDebugTarget) {
        context.executionLog.push({
          nodeId: node.data.identifier.id,
          timestamp: Date.now(),
          action: 'execute',
          data: {
            type: 'print_output',
            label,
            nodeDisplayName,
            value,
            valueType,
            formattedValue,
            executionContext: {
              hasConnections: true,
              inputCount: inputs.length,
              currentInputIndex: inputIndex,
              executionId,
              flowState: 'executed_successfully',
              // Additional metadata for customer debugging
              dataSize: this.getDataSize(value),
              isComplexObject: this.isComplexObject(value),
              hasNestedData: this.hasNestedData(value),
              sourceMetadata: input.metadata ?? {}
            }
          }
        });
      }
    }
  }

  private getValueType(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return `array[${value.length}]`;
    if (typeof value === 'object') return `object`;
    return typeof value;
  }

  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[Complex Object]';
      }
    }
    // For other types (function, symbol, etc.)
    return `[${typeof value}]`;
  }

  // Enhanced helper methods for production debugging
  private getDataSize(value: unknown): string {
    if (value === null || value === undefined) return '0 bytes';
    
    try {
      const str = JSON.stringify(value);
      const bytes = new Blob([str]).size;
      
      if (bytes < 1024) return `${bytes} bytes`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } catch {
      return 'unknown size';
    }
  }

  private isComplexObject(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    if (Array.isArray(value)) return value.length > 10;
    
    try {
      const keys = Object.keys(value);
      return keys.length > 5;
    } catch {
      return false;
    }
  }

  private hasNestedData(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    
    try {
      if (Array.isArray(value)) {
        return value.some(item => typeof item === 'object' && item !== null);
      }
      
      const values = Object.values(value);
      return values.some(val => typeof val === 'object' && val !== null);
    } catch {
      return false;
    }
  }

  private async executeFilter(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const selectedObjectIds = (data.selectedObjectIds as string[]) || [];

    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    if (inputs.length === 0) {
      setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', [], { perObjectTimeCursor: {} });
      return;
    }

    const filteredResults: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);

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

    const filteredIds = extractObjectIdsFromInputs([{ data: filteredResults }]);
    const propagatedCursors = pickCursorsForIds(upstreamCursorMap, filteredIds);
    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      filteredResults,
      { perObjectTimeCursor: propagatedCursors }
    );
  }

  private hasFilterableObjects(item: unknown): boolean {
    return typeof item === 'object' && item !== null && 'id' in item;
  }

  private filterItem(item: unknown, selectedObjectIds: string[]): unknown {
    if (typeof item === 'object' && item !== null && 'id' in item) {
      const objectId = (item as { id: string }).id;
      return selectedObjectIds.includes(objectId) ? item : null;
    }

    return item;
  }

  private async executeMerge(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    logger.debug(`Starting merge execution for node: ${node.data.identifier.displayName}`);
    
    const data = node.data as unknown as Record<string, unknown>;
    const portCount = Number(data.inputPortCount) || 2;
    
    logger.debug(`Merge port count: ${portCount}`);
    
    // Collect inputs from all ports in priority order
    const portInputs: ExecutionValue[][] = [];
    for (let i = 1; i <= portCount; i++) {
      const inputs = getConnectedInputs(
        context,
        connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
        node.data.identifier.id,
        `input${i}`
      );
      portInputs.push(inputs);
      logger.debug(`Merge port ${i} inputs`, { connections: inputs.length });
    }

    // Merge logic: collect all objects, resolve conflicts by port priority
    const mergedObjects = new Map<string, unknown>();
    const allCursorMaps: Record<string, number>[] = [];

    logger.debug('Processing ports in reverse order for priority (Port 1 = highest priority)');

    // Process ports in reverse order so Port 1 (index 0) has highest priority
    for (let portIndex = portCount - 1; portIndex >= 0; portIndex--) {
      const inputs = portInputs[portIndex];
      if (!inputs) continue;
      logger.debug(`Processing port ${portIndex + 1}`, { inputs: inputs.length });
      
      for (const input of inputs) {
        const inputData = Array.isArray(input.data) ? input.data : [input.data];
        logger.debug(`Port ${portIndex + 1} input data`, { items: inputData.length });
        
        // Extract cursor metadata
        const maybeMap = (input.metadata as { perObjectTimeCursor?: unknown } | undefined)?.perObjectTimeCursor;
        if (isPerObjectCursorMap(maybeMap)) {
          allCursorMaps.push(maybeMap);
        }

        for (const obj of inputData) {
          if (typeof obj === 'object' && obj !== null && 'id' in obj) {
            const objectId = (obj as { id: string }).id;
            
            const existingObject = mergedObjects.get(objectId);
            if (existingObject) {
              logger.debug(`Object ID conflict detected: ${objectId}`, {
                existingObject,
                newObject: obj,
                resolution: `Port ${portIndex + 1} overwrites previous`
              });
            } else {
              logger.debug(`Adding new object ID: ${objectId} from port ${portIndex + 1}`);
            }
            
            // Port priority: later iteration (lower port index) overwrites
            mergedObjects.set(objectId, obj);
          } else {
            logger.debug('Non-object or object without ID', { obj });
          }
        }
      }
    }

    const mergedResult = Array.from(mergedObjects.values());
    const mergedCursors = mergeCursorMaps(allCursorMaps);

    const inputObjectCount = portInputs.flat().reduce((acc, input) => {
      const data = Array.isArray(input.data) ? input.data : [input.data];
      return acc + data.length;
    }, 0);
    const outputIds = mergedResult.map(obj => 
      typeof obj === 'object' && obj !== null && 'id' in obj ? (obj as { id: string }).id : null
    ).filter(id => id !== null);
    logger.debug('Final merged result', {
      inputObjectCount,
      outputObjectCount: mergedResult.length,
      uniqueObjectIds: outputIds
    });
    
    // CRITICAL: Verify no duplicate IDs in output
    
    const uniqueOutputIds = new Set(outputIds);
    logger.debug('Output verification', { totalIds: outputIds.length, uniqueIds: uniqueOutputIds.size });
    
    if (outputIds.length !== uniqueOutputIds.size) {
      console.error(`[MERGE] ERROR: Merge node is outputting duplicate object IDs!`);
      console.error(`[MERGE] All output IDs:`, outputIds);
      console.error(`[MERGE] Duplicate IDs:`, outputIds.filter((id, index) => outputIds.indexOf(id) !== index));
      throw new Error(`Merge node ${node.data.identifier.displayName} failed to deduplicate objects`);
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      mergedResult,
      { perObjectTimeCursor: mergedCursors }
    );
    
    logger.debug('Merge execution completed successfully');
  }

  private extractCursorsFromInputs(inputs: ExecutionValue[]): Record<string, number> {
    const maps: Record<string, number>[] = [];
    for (const input of inputs) {
      const maybeMap = (input.metadata as { perObjectTimeCursor?: unknown } | undefined)?.perObjectTimeCursor;
      if (isPerObjectCursorMap(maybeMap)) {
        maps.push(maybeMap);
      }
    }
    return mergeCursorMaps(maps);
  }

  private async executeCompare(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as {
      operator: 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte';
    };
    
    let inputA: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
    let inputB: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
    
    try {
      inputA = getTypedConnectedInput<number>(
        context, 
        connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
        node.data.identifier.id, 
        'input_a', 
        'number'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(`Type validation failed for input A in Compare node ${node.data.identifier.displayName}: ${error.message}`);
        throw error;
      }
      throw error;
    }
    
    try {
      inputB = getTypedConnectedInput<number>(
        context, 
        connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
        node.data.identifier.id, 
        'input_b', 
        'number'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(`Type validation failed for input B in Compare node ${node.data.identifier.displayName}: ${error.message}`);
        throw error;
      }
      throw error;
    }
    
    if (!inputA || !inputB) {
      throw new Error(`Compare node ${node.data.identifier.displayName} missing required inputs`);
    }
    
    const valueA = inputA.data;
    const valueB = inputB.data;
      
      let result: boolean;
      switch (data.operator) {
        case 'gt': result = valueA > valueB; break;
        case 'lt': result = valueA < valueB; break;
        case 'eq': result = valueA === valueB; break;
        case 'neq': result = valueA !== valueB; break;
        case 'gte': result = valueA >= valueB; break;
        case 'lte': result = valueA <= valueB; break;
        default: {
          const _exhaustive: never = data.operator;
          throw new Error(`Unknown operator: ${String(_exhaustive)}`);
        }
      }
      
      logger.debug(`Compare ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`);
      
      setNodeOutput(
        context,
        node.data.identifier.id,
        'output',
        'data',
        result,
        { logicType: 'boolean', validated: true }
      );
    // Note: Error handling is done above for individual inputs
  }

  private async executeIfElse(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    let condition: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;
    
    try {
      condition = getTypedConnectedInput<boolean>(
        context, 
        connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
        node.data.identifier.id, 
        'condition', 
        'boolean'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(`Type validation failed for condition in If/Else node ${node.data.identifier.displayName}: ${error.message}`);
        throw error;
      }
      throw error;
    }
    
    if (!condition) {
      throw new Error(`If/Else node ${node.data.identifier.displayName} missing condition input`);
    }
    
    const conditionValue = condition.data;
      
      // Simple: if true, output true. If false, output false.
      if (conditionValue) {
        setNodeOutput(context, node.data.identifier.id, 'true_path', 'data', true);
        logger.debug(`If/Else ${node.data.identifier.displayName}: condition=true, output=true on true_path`);
      } else {
        setNodeOutput(context, node.data.identifier.id, 'false_path', 'data', false);
        logger.debug(`If/Else ${node.data.identifier.displayName}: condition=false, output=false on false_path`);
      }
    // Note: Error handling is done above for condition input
  }

  private async executeBooleanOp(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as {
      operator: 'and' | 'or' | 'not' | 'xor';
    };
    
    if (data.operator === 'not') {
      // NOT operation - single input
      let input: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;
      
      try {
        input = getTypedConnectedInput<boolean>(
          context, 
          connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
          node.data.identifier.id, 
          'input1', 
          'boolean'
        );
      } catch (error) {
        if (error instanceof TypeValidationError) {
          logger.error(`Type validation failed for input in Boolean NOT node ${node.data.identifier.displayName}: ${error.message}`);
          throw error;
        }
        throw error;
      }
      
      if (!input) {
        throw new Error(`Boolean NOT node ${node.data.identifier.displayName} missing input`);
      }
      
      const result = !input.data;
      logger.debug(`Boolean NOT ${node.data.identifier.displayName}: !${input.data} = ${result}`);
      
      setNodeOutput(
        context,
        node.data.identifier.id,
        'output',
        'data',
        result,
        { logicType: 'boolean', validated: true }
      );
      return;
    }
    
    // Binary operations (AND, OR, XOR) - two inputs
    let inputA: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;
    let inputB: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;
    
    try {
      inputA = getTypedConnectedInput<boolean>(
        context, 
        connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
        node.data.identifier.id, 
        'input1', 
        'boolean'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(`Type validation failed for input A in Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`);
        throw error;
      }
      throw error;
    }
    
    try {
      inputB = getTypedConnectedInput<boolean>(
        context, 
        connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
        node.data.identifier.id, 
        'input2', 
        'boolean'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(`Type validation failed for input B in Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`);
        throw error;
      }
      throw error;
    }
    
    if (!inputA || !inputB) {
      throw new Error(`Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing required inputs`);
    }
    
    const valueA = inputA.data;
    const valueB = inputB.data;
    
    let result: boolean;
    switch (data.operator) {
      case 'and':
        result = valueA && valueB;
        break;
      case 'or':
        result = valueA || valueB;
        break;
      case 'xor':
        result = valueA !== valueB; // XOR: true when inputs differ
        break;
      default: {
        const _exhaustive: never = data.operator;
        throw new Error(`Unknown boolean operator: ${String(_exhaustive)}`);
      }
    }
    
    logger.debug(`Boolean ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`);
    
    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'data',
      result,
      { logicType: 'boolean', validated: true }
    );
  }

  private async executeMathOp(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as {
      operator: 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power' | 'sqrt' | 'abs' | 'min' | 'max';
    };
    
    if (data.operator === 'sqrt' || data.operator === 'abs') {
      // Unary operations - single input
      let input: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
      
      try {
        input = getTypedConnectedInput<number>(
          context, 
          connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
          node.data.identifier.id, 
          'input_a', 
          'number'
        );
      } catch (error) {
        if (error instanceof TypeValidationError) {
          logger.error(`Type validation failed for input in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`);
          throw error;
        }
        throw error;
      }
      
      if (!input) {
        throw new Error(`Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing input`);
      }
      
      let result: number;
      switch (data.operator) {
        case 'sqrt':
          if (input.data < 0) {
            throw new Error(`Math SQRT node ${node.data.identifier.displayName}: Cannot take square root of negative number (${input.data})`);
          }
          result = Math.sqrt(input.data);
          break;
        case 'abs':
          result = Math.abs(input.data);
          break;
        default: {
          const _exhaustive: never = data.operator;
          throw new Error(`Unknown unary math operator: ${String(_exhaustive)}`);
        }
      }
      
      logger.debug(`Math ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${data.operator}(${input.data}) = ${result}`);
      
      setNodeOutput(
        context,
        node.data.identifier.id,
        'output',
        'data',
        result,
        { logicType: 'number', validated: true }
      );
      return;
    }
    
    // Binary operations - two inputs
    let inputA: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
    let inputB: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
    
    try {
      inputA = getTypedConnectedInput<number>(
        context, 
        connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
        node.data.identifier.id, 
        'input_a', 
        'number'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(`Type validation failed for input A in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`);
        throw error;
      }
      throw error;
    }
    
    try {
      inputB = getTypedConnectedInput<number>(
        context, 
        connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>, 
        node.data.identifier.id, 
        'input_b', 
        'number'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(`Type validation failed for input B in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`);
        throw error;
      }
      throw error;
    }
    
    if (!inputA || !inputB) {
      throw new Error(`Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing required inputs`);
    }
    
    const valueA = inputA.data;
    const valueB = inputB.data;
    
    let result: number;
    switch (data.operator) {
      case 'add': 
        result = valueA + valueB; 
        break;
      case 'subtract': 
        result = valueA - valueB; 
        break;
      case 'multiply': 
        result = valueA * valueB; 
        break;
      case 'divide': 
        if (valueB === 0) {
          throw new Error(`Math DIVIDE node ${node.data.identifier.displayName}: Division by zero (A=${valueA}, B=${valueB})`);
        }
        result = valueA / valueB; 
        break;
      case 'modulo': 
        if (valueB === 0) {
          throw new Error(`Math MODULO node ${node.data.identifier.displayName}: Modulo by zero (A=${valueA}, B=${valueB})`);
        }
        result = valueA % valueB; 
        break;
      case 'power':
        result = Math.pow(valueA, valueB);
        break;
      case 'min': 
        result = Math.min(valueA, valueB); 
        break;
      case 'max': 
        result = Math.max(valueA, valueB); 
        break;
      default: {
        const _exhaustive: never = data.operator;
        throw new Error(`Unknown binary math operator: ${String(_exhaustive)}`);
      }
    }
    
    // Handle special cases for result validation
    if (!Number.isFinite(result)) {
      if (Number.isNaN(result)) {
        throw new Error(`Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: Operation resulted in NaN (A=${valueA}, B=${valueB})`);
      }
      if (!Number.isFinite(result)) {
        logger.warn(`Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: Operation resulted in ${result} (A=${valueA}, B=${valueB})`);
      }
    }
    
    logger.debug(`Math ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`);
    
    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'data',
      result,
      { logicType: 'number', validated: true }
    );
  }
}