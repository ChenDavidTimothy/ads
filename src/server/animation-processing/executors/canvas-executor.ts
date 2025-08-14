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
    if (pos && typeof pos === 'object' && pos !== null && 'x' in (pos as any) && 'y' in (pos as any)) {
      data.position = { x: Number((pos as any).x), y: Number((pos as any).y) };
    }
    const posX = readVarGlobal('position.x');
    if (typeof posX === 'number') {
      const current = (data.position as { x: number; y: number }) ?? { x: 0, y: 0 };
      data.position = { x: posX, y: current.y };
    }
    const posY = readVarGlobal('position.y');
    if (typeof posY === 'number') {
      const current = (data.position as { x: number; y: number }) ?? { x: 0, y: 0 };
      data.position = { x: current.x, y: posY };
    }
    const rot = readVarGlobal('rotation');
    if (typeof rot === 'number') data.rotation = rot;
    const scale = readVarGlobal('scale');
    if (scale && typeof scale === 'object' && scale !== null && 'x' in (scale as any) && 'y' in (scale as any)) {
      data.scale = { x: Number((scale as any).x), y: Number((scale as any).y) };
    }
    const scaleX = readVarGlobal('scale.x');
    if (typeof scaleX === 'number') {
      const current = (data.scale as { x: number; y: number }) ?? { x: 1, y: 1 };
      data.scale = { x: scaleX, y: current.y };
    }
    const scaleY = readVarGlobal('scale.y');
    if (typeof scaleY === 'number') {
      const current = (data.scale as { x: number; y: number }) ?? { x: 1, y: 1 };
      data.scale = { x: current.x, y: scaleY };
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
          // Object-level variable bindings override defaults
          const oPos = reader('position');
          if (oPos && typeof oPos === 'object' && oPos !== null && 'x' in (oPos as any) && 'y' in (oPos as any)) {
            data.position = { x: Number((oPos as any).x), y: Number((oPos as any).y) };
          }
          const oPosX = reader('position.x');
          if (typeof oPosX === 'number') {
            const current = (data.position as { x: number; y: number }) ?? { x: 0, y: 0 };
            data.position = { x: oPosX, y: current.y };
          }
          const oPosY = reader('position.y');
          if (typeof oPosY === 'number') {
            const current = (data.position as { x: number; y: number }) ?? { x: 0, y: 0 };
            data.position = { x: current.x, y: oPosY };
          }
          const oRot = reader('rotation');
          if (typeof oRot === 'number') data.rotation = oRot;
          const oScale = reader('scale');
          if (oScale && typeof oScale === 'object' && oScale !== null && 'x' in (oScale as any) && 'y' in (oScale as any)) {
            data.scale = { x: Number((oScale as any).x), y: Number((oScale as any).y) };
          }
          const oScaleX = reader('scale.x');
          if (typeof oScaleX === 'number') {
            const currentS = (data.scale as { x: number; y: number }) ?? { x: 1, y: 1 };
            data.scale = { x: oScaleX, y: currentS.y };
          }
          const oScaleY = reader('scale.y');
          if (typeof oScaleY === 'number') {
            const currentS = (data.scale as { x: number; y: number }) ?? { x: 1, y: 1 };
            data.scale = { x: currentS.x, y: oScaleY };
          }
          const oOpacity = reader('opacity');
          if (typeof oOpacity === 'number') data.opacity = oOpacity;
          const oFill = reader('fillColor');
          if (typeof oFill === 'string') data.fillColor = oFill;
          const oStroke = reader('strokeColor');
          if (typeof oStroke === 'string') data.strokeColor = oStroke;
          const oStrokeW = reader('strokeWidth');
          if (typeof oStrokeW === 'number') data.strokeWidth = oStrokeW;
          const assignmentsForObject = mergedAssignments?.[objectId];
          const { initialPosition, initialRotation, initialScale, initialOpacity, properties } = resolveInitialObject(
            original as unknown as SceneObject,
            canvasOverrides,
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