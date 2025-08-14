// src/server/animation-processing/executors/canvas-executor.ts
import type { NodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import type { SceneAnimationTrack, SceneObject } from "@/shared/types/scene";
import { resolveInitialObject, type CanvasOverrides } from "@/shared/properties/resolver";
import type { PerObjectAssignments } from "@/shared/properties/assignments";
import { mergeObjectAssignments, type ObjectAssignments } from "@/shared/properties/assignments";

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
    const pos = readVarGlobal('position');
    const posX = readVarGlobal('position.x');
    const posY = readVarGlobal('position.y');
    if (pos && typeof pos === 'object' && pos !== null && 'x' in (pos as any) && 'y' in (pos as any)) {
      data.position = { x: Number((pos as any).x), y: Number((pos as any).y) };
    }
    if (typeof posX === 'number' || typeof posY === 'number') {
      const base = (data.position as { x?: number; y?: number } | undefined) ?? { x: 0, y: 0 };
      data.position = { x: typeof posX === 'number' ? posX : Number(base.x ?? 0), y: typeof posY === 'number' ? posY : Number(base.y ?? 0) };
    }
    const rot = readVarGlobal('rotation');
    if (typeof rot === 'number') data.rotation = rot;
    const scale = readVarGlobal('scale');
    const scaleX = readVarGlobal('scale.x');
    const scaleY = readVarGlobal('scale.y');
    if (scale && typeof scale === 'object' && scale !== null && 'x' in (scale as any) && 'y' in (scale as any)) {
      data.scale = { x: Number((scale as any).x), y: Number((scale as any).y) };
    }
    if (typeof scaleX === 'number' || typeof scaleY === 'number') {
      const base = (data.scale as { x?: number; y?: number } | undefined) ?? { x: 1, y: 1 };
      data.scale = { x: typeof scaleX === 'number' ? scaleX : Number(base.x ?? 1), y: typeof scaleY === 'number' ? scaleY : Number(base.y ?? 1) };
    }
    const opacity = readVarGlobal('opacity');
    if (typeof opacity === 'number') data.opacity = opacity;
    const fill = readVarGlobal('fillColor');
    if (typeof fill === 'string') data.fillColor = fill;
    const stroke = readVarGlobal('strokeColor');
    if (typeof stroke === 'string') data.strokeColor = stroke;
    const strokeW = readVarGlobal('strokeWidth');
    if (typeof strokeW === 'number') data.strokeWidth = strokeW;

    const passThrough: unknown[] = [];

    const canvasOverrides: CanvasOverrides = {
      position: data.position as { x: number; y: number } | undefined,
      rotation: data.rotation as number | undefined,
      scale: data.scale as { x: number; y: number } | undefined,
      opacity: data.opacity as number | undefined,
      fillColor: data.fillColor as string | undefined,
      strokeColor: data.strokeColor as string | undefined,
      strokeWidth: data.strokeWidth as number | undefined,
    };

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

          // Build object-specific overrides from global + per-object bindings
          const oPos = reader('position');
          const oPosX = reader('position.x');
          const oPosY = reader('position.y');
          const oRot = reader('rotation');
          const oScale = reader('scale');
          const oScaleX = reader('scale.x');
          const oScaleY = reader('scale.y');
          const oOpacity = reader('opacity');
          const oFill = reader('fillColor');
          const oStroke = reader('strokeColor');
          const oStrokeW = reader('strokeWidth');

          const objectOverrides: CanvasOverrides = { ...canvasOverrides };
          // position precedence: object-specific x/y > object-specific vec > global vec
          if (oPos && typeof oPos === 'object' && oPos !== null && 'x' in (oPos as any) && 'y' in (oPos as any)) {
            objectOverrides.position = { x: Number((oPos as any).x), y: Number((oPos as any).y) };
          }
          if (typeof oPosX === 'number' || typeof oPosY === 'number') {
            const base = objectOverrides.position ?? { x: 0, y: 0 };
            objectOverrides.position = { x: typeof oPosX === 'number' ? oPosX : base.x, y: typeof oPosY === 'number' ? oPosY : base.y };
          }
          if (typeof oRot === 'number') objectOverrides.rotation = oRot as number;
          if (oScale && typeof oScale === 'object' && oScale !== null && 'x' in (oScale as any) && 'y' in (oScale as any)) {
            objectOverrides.scale = { x: Number((oScale as any).x), y: Number((oScale as any).y) };
          }
          if (typeof oScaleX === 'number' || typeof oScaleY === 'number') {
            const base = objectOverrides.scale ?? { x: 1, y: 1 };
            objectOverrides.scale = { x: typeof oScaleX === 'number' ? oScaleX : base.x, y: typeof oScaleY === 'number' ? oScaleY : base.y };
          }
          if (typeof oOpacity === 'number') objectOverrides.opacity = oOpacity as number;
          if (typeof oFill === 'string') objectOverrides.fillColor = oFill as string;
          if (typeof oStroke === 'string') objectOverrides.strokeColor = oStroke as string;
          if (typeof oStrokeW === 'number') objectOverrides.strokeWidth = oStrokeW as number;

          const assignmentsForObject = mergedAssignments?.[objectId];
          const { initialPosition, initialRotation, initialScale, initialOpacity, properties } = resolveInitialObject(
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
        merged[objectId] = { ...(merged[objectId] ?? {}), ...assignment };
      }
    }
    return found ? merged : undefined;
  }
}