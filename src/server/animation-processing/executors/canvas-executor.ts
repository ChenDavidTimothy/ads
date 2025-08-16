// src/server/animation-processing/executors/canvas-executor.ts
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import type { SceneAnimationTrack, SceneObject } from "@/shared/types/scene";
import { resolveInitialObject, type CanvasOverrides } from "@/shared/properties/resolver";
import type { PerObjectAssignments } from "@/shared/properties/assignments";
import { mergeObjectAssignments, type ObjectAssignments } from "@/shared/properties/assignments";
import { setByPath } from "@/shared/utils/object-path";
import { deleteByPath } from "@/shared/utils/object-path";

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

    // Start with node defaults as overrides
    const baseOverrides: CanvasOverrides = {
      position: data.position as { x: number; y: number } | undefined,
      rotation: data.rotation as number | undefined,
      scale: data.scale as { x: number; y: number } | undefined,
      opacity: data.opacity as number | undefined,
      fillColor: data.fillColor as string | undefined,
      strokeColor: data.strokeColor as string | undefined,
      strokeWidth: data.strokeWidth as number | undefined,
    };

    // Apply all global binding keys generically into baseOverrides
    const globalKeys = Object.keys(bindings);
    const nodeOverrides: CanvasOverrides = JSON.parse(JSON.stringify(baseOverrides));
    for (const key of globalKeys) {
      const val = readVarGlobal(key);
      if (val === undefined) continue;
      setByPath(nodeOverrides as unknown as Record<string, unknown>, key, val);
    }

    const passThrough: unknown[] = [];

    // Read optional per-object assignments metadata (from upstream)
    const upstreamAssignments: PerObjectAssignments | undefined = this.extractPerObjectAssignments(inputs);
    // Read node-level assignments stored on the Canvas node itself
    const nodeAssignments: PerObjectAssignments | undefined = (data.perObjectAssignments as PerObjectAssignments | undefined);

    // Merge upstream + node-level; node-level takes precedence per object
    const mergedAssignments: PerObjectAssignments | undefined = (() => {
      if (!upstreamAssignments && !nodeAssignments) return undefined;
      const result: PerObjectAssignments = {};
      const objectIds = new Set<string>([
        ...Object.keys(upstreamAssignments ?? {}),
        ...Object.keys(nodeAssignments ?? {}),
      ]);
      for (const objectId of objectIds) {
        const base = upstreamAssignments?.[objectId];
        const overrides = nodeAssignments?.[objectId];
        const merged = mergeObjectAssignments(base, overrides);
        if (merged) result[objectId] = merged as ObjectAssignments;
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
          const objectOverrides: CanvasOverrides = JSON.parse(JSON.stringify(nodeOverrides));
          const objectKeys = Object.keys(bindingsByObject[objectId] ?? {});
          for (const key of objectKeys) {
            const val = reader(key);
            if (val === undefined) continue;
            setByPath(objectOverrides as unknown as Record<string, unknown>, key, val);
          }

          const assignmentsForObject = mergedAssignments?.[objectId];
          const maskedAssignmentsForObject = (() => {
            if (!assignmentsForObject) return undefined;
            const keys = [...globalKeys, ...objectKeys];
            const next: any = { ...assignmentsForObject };
            const initial = { ...(next.initial ?? {}) } as Record<string, unknown>;
            for (const key of keys) {
              switch (key) {
                case 'position.x': deleteByPath(initial as any, 'position.x'); break;
                case 'position.y': deleteByPath(initial as any, 'position.y'); break;
                case 'scale.x': deleteByPath(initial as any, 'scale.x'); break;
                case 'scale.y': deleteByPath(initial as any, 'scale.y'); break;
                case 'rotation': delete (initial as any).rotation; break;
                case 'opacity': delete (initial as any).opacity; break;
                case 'fillColor': delete (initial as any).fillColor; break;
                case 'strokeColor': delete (initial as any).strokeColor; break;
                case 'strokeWidth': delete (initial as any).strokeWidth; break;
                default: break;
              }
            }
            const prunedInitial = (() => {
              const obj = JSON.parse(JSON.stringify(initial));
              const prune = (o: any) => {
                if (!o || typeof o !== 'object') return o;
                for (const k of Object.keys(o)) {
                  if (o[k] && typeof o[k] === 'object') {
                    o[k] = prune(o[k]);
                    if (Object.keys(o[k]).length === 0) delete o[k];
                  }
                }
                return o;
              };
              return prune(obj);
            })();
            if (Object.keys(prunedInitial).length > 0) next.initial = prunedInitial; else delete next.initial;
            return next as ObjectAssignments;
          })();

          const { initialPosition, initialRotation, initialScale, initialOpacity, properties } = resolveInitialObject(
            original as unknown as SceneObject,
            objectOverrides,
            maskedAssignmentsForObject
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
    const firstMeta = inputs[0]?.metadata as { perObjectTimeCursor?: Record<string, number>; perObjectAnimations?: Record<string, SceneAnimationTrack[]>; perObjectAssignments?: PerObjectAssignments } | undefined;

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThrough,
      {
        perObjectTimeCursor: firstMeta?.perObjectTimeCursor,
        perObjectAnimations: firstMeta?.perObjectAnimations,
        perObjectAssignments: mergedAssignments ?? firstMeta?.perObjectAssignments,
      }
    );
  }

  private extractPerObjectAssignments(inputs: Array<{ metadata?: unknown }>): PerObjectAssignments | undefined {
    const merged: PerObjectAssignments = {};
    let found = false;
    for (const input of inputs) {
      const fromMeta = (input.metadata as { perObjectAssignments?: PerObjectAssignments } | undefined)?.perObjectAssignments;
      if (!fromMeta) continue;
      for (const [objectId, assignment] of Object.entries(fromMeta)) {
        found = true;
        const base = merged[objectId];
        const combined = mergeObjectAssignments(base, assignment as any);
        if (combined) merged[objectId] = combined as ObjectAssignments;
      }
    }
    return found ? merged : undefined;
  }
}