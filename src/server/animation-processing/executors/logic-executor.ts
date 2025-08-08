// src/server/animation-processing/executors/logic-executor.ts
import { getNodeExecutionConfig } from "@/shared/registry/registry-utils";
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import type { NodeExecutor } from "./node-executor";
import { extractObjectIdsFromInputs, isPerObjectCursorMap, mergeCursorMaps, pickCursorsForIds } from "../scene/scene-assembler";

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
      default:
        throw new Error(`Unknown logic node type: ${node.type}`);
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
    console.log(`[MERGE] Starting merge execution for node: ${node.data.identifier.displayName}`);
    
    const data = node.data as unknown as Record<string, unknown>;
    const portCount = Number(data.inputPortCount) || 2;
    
    console.log(`[MERGE] Port count: ${portCount}`);
    
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
      console.log(`[MERGE] Port ${i} inputs:`, inputs.length, 'connections');
    }

    // Merge logic: collect all objects, resolve conflicts by port priority
    const mergedObjects = new Map<string, unknown>();
    const allCursorMaps: Record<string, number>[] = [];

    console.log(`[MERGE] Processing ports in reverse order for priority (Port 1 = highest priority)`);

    // Process ports in reverse order so Port 1 (index 0) has highest priority
    for (let portIndex = portCount - 1; portIndex >= 0; portIndex--) {
      const inputs = portInputs[portIndex];
      console.log(`[MERGE] Processing port ${portIndex + 1} (${inputs.length} inputs)`);
      
      for (const input of inputs || []) {
        const inputData = Array.isArray(input.data) ? input.data : [input.data];
        console.log(`[MERGE] Port ${portIndex + 1} input data:`, inputData.length, 'items');
        
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
              console.log(`[MERGE] Object ID conflict detected: ${objectId}`);
              console.log(`[MERGE] Existing object (from earlier port):`, existingObject);
              console.log(`[MERGE] New object (from port ${portIndex + 1}):`, obj);
              console.log(`[MERGE] Port ${portIndex + 1} overwrites previous (priority resolution)`);
            } else {
              console.log(`[MERGE] Adding new object ID: ${objectId} from port ${portIndex + 1}`);
            }
            
            // Port priority: later iteration (lower port index) overwrites
            mergedObjects.set(objectId, obj);
          } else {
            console.log(`[MERGE] Non-object or object without ID:`, obj);
          }
        }
      }
    }

    const mergedResult = Array.from(mergedObjects.values());
    const mergedCursors = mergeCursorMaps(allCursorMaps);

    console.log(`[MERGE] Final merged result:`);
    console.log(`[MERGE] Input object count across all ports: ${portInputs.flat().reduce((acc, input) => {
      const data = Array.isArray(input.data) ? input.data : [input.data];
      return acc + data.length;
    }, 0)}`);
    console.log(`[MERGE] Output object count: ${mergedResult.length}`);
    console.log(`[MERGE] Unique object IDs in output:`, mergedResult.map(obj => 
      typeof obj === 'object' && obj !== null && 'id' in obj ? (obj as { id: string }).id : 'NO_ID'
    ));
    
    // CRITICAL: Verify no duplicate IDs in output
    const outputIds = mergedResult.map(obj => 
      typeof obj === 'object' && obj !== null && 'id' in obj ? (obj as { id: string }).id : null
    ).filter(id => id !== null);
    
    const uniqueOutputIds = new Set(outputIds);
    console.log(`[MERGE] Output verification - Total IDs: ${outputIds.length}, Unique IDs: ${uniqueOutputIds.size}`);
    
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
    
    console.log(`[MERGE] Merge execution completed successfully`);
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