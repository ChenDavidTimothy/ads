// src/server/animation-processing/executors/logic-executor.ts
import { getNodeExecutionConfig } from "@/shared/registry/registry-utils";
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import type { NodeExecutor } from "./node-executor";
import { extractObjectIdsFromInputs, isPerObjectCursorMap, mergeCursorMaps, pickCursorsForIds } from "../scene/scene-assembler";
import { logger } from "@/lib/logger";

export class LogicNodeExecutor implements NodeExecutor {
  canHandle(nodeType: string): boolean {
    const executionConfig = getNodeExecutionConfig(nodeType);
    return executionConfig?.executor === 'logic';
  }

  async execute(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    switch (node.type) {
      case 'filter':
        await this.executeFilter(node, context, connections);
        break;
      case 'merge':
        await this.executeMerge(node, context, connections);
        break;
      case 'constants':
        await this.executeConstants(node, context, connections);
        break;
      case 'print':
        await this.executePrint(node, context, connections);
        break;
      default:
        throw new Error(`Unknown logic node type: ${node.type}`);
    }
  }

  private async executeConstants(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    _connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const valueType = data.valueType as string;
    
    let outputValue: unknown;
    
    switch (valueType) {
      case 'number':
        outputValue = Number(data.numberValue);
        break;
      case 'string':
        outputValue = String(data.stringValue || '');
        break;
      case 'boolean':
        outputValue = (data.booleanValue as string) === 'true';
        break;
      case 'color':
        outputValue = String(data.colorValue || '#ffffff');
        break;
      default:
        outputValue = 0;
        logger.warn(`Unknown value type: ${valueType}, defaulting to 0`);
    }

    logger.debug(`Constants ${node.data.identifier.displayName}: ${valueType} = ${outputValue}`);
    
    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'data',
      outputValue
    );
  }

  private async executePrint(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const label = String(data.label || 'Debug');
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
              sourceMetadata: input.metadata || {}
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
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
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
      logger.debug(`Processing port ${portIndex + 1}`, { inputs: inputs.length });
      
      for (const input of inputs || []) {
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
}