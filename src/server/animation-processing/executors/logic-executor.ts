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
    const data = node.data as unknown as Record<string, unknown>;
    const portCount = Number(data.inputPortCount) || 2;
    
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
    }

    // Merge logic: collect all objects, resolve conflicts by port priority
    const mergedObjects = new Map<string, unknown>();
    const allCursorMaps: Record<string, number>[] = [];

    // Process ports in reverse order so Port 1 (index 0) has highest priority
    for (let portIndex = portCount - 1; portIndex >= 0; portIndex--) {
      const inputs = portInputs[portIndex];
      
      for (const input of inputs || []) {
        const inputData = Array.isArray(input.data) ? input.data : [input.data];
        
        // Extract cursor metadata
        const maybeMap = (input.metadata as { perObjectTimeCursor?: unknown } | undefined)?.perObjectTimeCursor;
        if (isPerObjectCursorMap(maybeMap)) {
          allCursorMaps.push(maybeMap);
        }

        for (const obj of inputData) {
          if (typeof obj === 'object' && obj !== null && 'id' in obj) {
            const objectId = (obj as { id: string }).id;
            // Port priority: later iteration (lower port index) overwrites
            mergedObjects.set(objectId, obj);
          }
        }
      }
    }

    const mergedResult = Array.from(mergedObjects.values());
    const mergedCursors = mergeCursorMaps(allCursorMaps);

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      mergedResult,
      { perObjectTimeCursor: mergedCursors }
    );
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


