// src/server/animation-processing/executors/canvas-executor.ts
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import type { SceneAnimationTrack, SceneObject } from "@/shared/types/scene";
import { resolveGranularObject, type GranularCanvasOverrides } from "@/shared/properties/granular-resolver";
import type { GranularPerObjectAssignments } from "@/shared/properties/granular-assignments";
import { convertLegacyToGranular, mergeGranularOverrides } from "@/shared/properties/granular-assignments";

export class CanvasNodeExecutor extends BaseExecutor {
  protected registerHandlers(): void {
    this.registerHandler('canvas', this.executeCanvas.bind(this));
  }

  private async executeCanvas(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    // Resolve variable bindings (Result nodes) at node level
    const bindings = (data.variableBindings as Record<string, { target?: string; boundResultNodeId?: string }> | undefined) ?? {};
    const bindingsByObject = (data.variableBindingsByObject as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>> | undefined) ?? {};
    const readVarGlobal = (key: string): unknown => {
      const rid = bindings[key]?.boundResultNodeId;
      if (!rid) return undefined;
      return (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))?.data;
    };
    const readVarForObject = (objectId: string | undefined) => (key: string): unknown => {
      if (!objectId) return readVarGlobal(key);
      const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
      if (rid) return (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))?.data;
      return readVarGlobal(key);
    };
    // Apply bound values to node defaults
    const setByPath = (target: Record<string, unknown>, path: string, value: unknown) => {
      const parts = path.split('.');
      let cursor: any = target;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i]!;
        const next = cursor[key];
        if (typeof next !== 'object' || next === null) cursor[key] = {};
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]!] = value as any;
    };

    // Start with node defaults as granular overrides
    const baseOverrides: GranularCanvasOverrides = {};
    
    // Convert node defaults to granular format
    const nodeDefaults = {
      position: data.position as { x: number; y: number } | undefined,
      rotation: data.rotation as number | undefined,
      scale: data.scale as { x: number; y: number } | undefined,
      opacity: data.opacity as number | undefined,
      fillColor: data.fillColor as string | undefined,
      strokeColor: data.strokeColor as string | undefined,
      strokeWidth: data.strokeWidth as number | undefined,
    };
    
    if (nodeDefaults.position) {
      baseOverrides['position.x'] = nodeDefaults.position.x;
      baseOverrides['position.y'] = nodeDefaults.position.y;
    }
    if (nodeDefaults.scale) {
      baseOverrides['scale.x'] = nodeDefaults.scale.x;
      baseOverrides['scale.y'] = nodeDefaults.scale.y;
    }
    if (nodeDefaults.rotation !== undefined) baseOverrides.rotation = nodeDefaults.rotation;
    if (nodeDefaults.opacity !== undefined) baseOverrides.opacity = nodeDefaults.opacity;
    if (nodeDefaults.fillColor !== undefined) baseOverrides.fillColor = nodeDefaults.fillColor;
    if (nodeDefaults.strokeColor !== undefined) baseOverrides.strokeColor = nodeDefaults.strokeColor;
    if (nodeDefaults.strokeWidth !== undefined) baseOverrides.strokeWidth = nodeDefaults.strokeWidth;

    // Apply all global binding keys generically into baseOverrides
    const globalKeys = Object.keys(bindings);
    const nodeOverrides: GranularCanvasOverrides = { ...baseOverrides };
    for (const key of globalKeys) {
      const val = readVarGlobal(key);
      if (val === undefined) continue;
      nodeOverrides[key] = val;
    }

    const passThrough: unknown[] = [];

    // Read optional per-object assignments metadata (from upstream and node)
    const upstreamAssignments: GranularPerObjectAssignments | undefined = this.extractGranularPerObjectAssignments(inputs);
    
    // Read node-level assignments (both legacy and new)
    const legacyNodeAssignments = (data.perObjectAssignments as any);
    const granularNodeAssignments = (data.granularPerObjectAssignments as GranularPerObjectAssignments | undefined);
    
    // Convert legacy assignments to granular if needed
    const nodeAssignments: GranularPerObjectAssignments | undefined = (() => {
      if (granularNodeAssignments) return granularNodeAssignments;
      if (!legacyNodeAssignments) return undefined;
      
      const converted: GranularPerObjectAssignments = {};
      for (const [objectId, assignment] of Object.entries(legacyNodeAssignments)) {
        const legacyInitial = (assignment as any)?.initial;
        if (legacyInitial) {
          converted[objectId] = {
            initial: convertLegacyToGranular(legacyInitial)
          };
        }
      }
      return converted;
    })();

    // Merge upstream + node-level; node-level takes precedence per object
    const mergedAssignments: GranularPerObjectAssignments | undefined = (() => {
      if (!upstreamAssignments && !nodeAssignments) return undefined;
      const result: GranularPerObjectAssignments = {};
      const objectIds = new Set<string>([
        ...Object.keys(upstreamAssignments ?? {}),
        ...Object.keys(nodeAssignments ?? {}),
      ]);
      for (const objectId of objectIds) {
        const base = upstreamAssignments?.[objectId]?.initial;
        const overrides = nodeAssignments?.[objectId]?.initial;
        const merged = mergeGranularOverrides(base, overrides);
        if (merged && Object.keys(merged).length > 0) {
          result[objectId] = { initial: merged };
        }
      }
      return result;
    })();

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const obj of inputData) {
        if (typeof obj === 'object' && obj !== null && 'id' in obj) {
          const original = obj as SceneObject as unknown as Record<string, unknown>;
          const objectId = (original as { id: string }).id;
          const reader = readVarForObject(objectId);
          const objectOverrides: GranularCanvasOverrides = { ...nodeOverrides };
          const objectKeys = Object.keys(bindingsByObject[objectId] ?? {});
          for (const key of objectKeys) {
            const val = reader(key);
            if (val === undefined) continue;
            objectOverrides[key] = val;
          }

          const assignmentsForObject = mergedAssignments?.[objectId];
          const { initialPosition, initialRotation, initialScale, initialOpacity, properties } = resolveGranularObject(
            original as unknown as SceneObject,
            objectOverrides,
            assignmentsForObject
          );

          const styled: Record<string, unknown> = {
            ...original,
            initialPosition,
            initialRotation,
            initialScale,
            initialOpacity,
            properties,
          };
          passThrough.push(styled);
        } else {
          passThrough.push(obj);
        }
      }
    }

    // Pass through existing per-object animations/cursors and the merged assignments
    const firstMeta = inputs[0]?.metadata as { perObjectTimeCursor?: Record<string, number>; perObjectAnimations?: Record<string, SceneAnimationTrack[]>; granularPerObjectAssignments?: GranularPerObjectAssignments } | undefined;

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThrough,
      {
        perObjectTimeCursor: firstMeta?.perObjectTimeCursor,
        perObjectAnimations: firstMeta?.perObjectAnimations,
        granularPerObjectAssignments: mergedAssignments ?? firstMeta?.granularPerObjectAssignments,
      }
    );
  }

  private extractGranularPerObjectAssignments(inputs: Array<{ metadata?: unknown }>): GranularPerObjectAssignments | undefined {
    const merged: GranularPerObjectAssignments = {};
    let found = false;
    for (const input of inputs) {
      const fromMeta = (input.metadata as { granularPerObjectAssignments?: GranularPerObjectAssignments } | undefined)?.granularPerObjectAssignments;
      if (!fromMeta) continue;
      for (const [objectId, assignment] of Object.entries(fromMeta)) {
        found = true;
        const existingInitial = merged[objectId]?.initial;
        const newInitial = assignment.initial;
        merged[objectId] = {
          initial: mergeGranularOverrides(existingInitial, newInitial)
        };
      }
    }
    return found ? merged : undefined;
  }
}