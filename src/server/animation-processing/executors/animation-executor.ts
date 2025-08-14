// src/server/animation-processing/executors/animation-executor.ts
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { convertTracksToSceneAnimations, isPerObjectCursorMap, mergeCursorMaps } from "../scene/scene-assembler";
import type { PerObjectAssignments } from "@/shared/properties/assignments";
import { mergeObjectAssignments, type ObjectAssignments } from "@/shared/properties/assignments";

export class AnimationNodeExecutor extends BaseExecutor {
  // Register animation node handlers
  protected registerHandlers(): void {
    this.registerHandler('animation', this.executeAnimation.bind(this));
  }

  private async executeAnimation(
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

    // Resolve variable bindings from upstream Result nodes
    const bindings = (data.variableBindings as Record<string, { target?: string; boundResultNodeId?: string }> | undefined) ?? {};
    const bindingsByObject = (data.variableBindingsByObject as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>> | undefined) ?? {};
    const readVarGlobal = (key: string): unknown => {
      const rid = bindings[key]?.boundResultNodeId;
      if (!rid) return undefined;
      const val = (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))?.data;
      return val;
    };
    const readVarForObject = (objectId: string | undefined) => (key: string): unknown => {
      if (!objectId) return readVarGlobal(key);
      const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
      if (rid) return (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))?.data;
      return readVarGlobal(key);
    };

    // Resolve duration binding if present (global only)
    const boundDuration = readVarGlobal('duration');
    if (typeof boundDuration === 'number') {
      data.duration = boundDuration;
    }

    // Clone tracks and apply per-track bindings
    const originalTracks: AnimationTrack[] = (data.tracks as AnimationTrack[]) || [];
    const resolveTrackWithBindings = (t: AnimationTrack, reader: (k: string) => unknown): AnimationTrack => {
      switch (t.type) {
        case 'move': {
          const fromX = reader('move.from.x');
          const fromY = reader('move.from.y');
          const toX = reader('move.to.x');
          const toY = reader('move.to.y');
          const fromPoint = reader('move.from');
          const toPoint = reader('move.to');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof fromX === 'number') next.properties.from = { ...next.properties.from, x: fromX };
          if (typeof fromY === 'number') next.properties.from = { ...next.properties.from, y: fromY };
          if (typeof toX === 'number') next.properties.to = { ...next.properties.to, x: toX };
          if (typeof toY === 'number') next.properties.to = { ...next.properties.to, y: toY };
          if (fromPoint && typeof fromPoint === 'object' && fromPoint !== null && 'x' in (fromPoint as any) && 'y' in (fromPoint as any)) {
            next.properties.from = { x: Number((fromPoint as any).x), y: Number((fromPoint as any).y) };
          }
          if (toPoint && typeof toPoint === 'object' && toPoint !== null && 'x' in (toPoint as any) && 'y' in (toPoint as any)) {
            next.properties.to = { x: Number((toPoint as any).x), y: Number((toPoint as any).y) };
          }
          return next;
        }
        case 'rotate': {
          const from = reader('rotate.from');
          const to = reader('rotate.to');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof from === 'number') next.properties.from = from;
          if (typeof to === 'number') next.properties.to = to;
          return next;
        }
        case 'scale': {
          const from = reader('scale.from');
          const to = reader('scale.to');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof from === 'number') next.properties.from = from;
          if (typeof to === 'number') next.properties.to = to;
          return next;
        }
        case 'fade': {
          const from = reader('fade.from');
          const to = reader('fade.to');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof from === 'number') next.properties.from = from;
          if (typeof to === 'number') next.properties.to = to;
          return next;
        }
        case 'color': {
          const from = reader('color.from');
          const to = reader('color.to');
          const prop = reader('color.property');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof from === 'string') next.properties.from = from;
          if (typeof to === 'string') next.properties.to = to;
          if (prop === 'fill' || prop === 'stroke') next.properties.property = prop;
          return next;
        }
        default:
          return t;
      }
    };
    const resolvedTracks: AnimationTrack[] = originalTracks.map((t) => {
      switch (t.type) {
        case 'move': {
          const fromX = readVarGlobal('move.from.x');
          const fromY = readVarGlobal('move.from.y');
          const toX = readVarGlobal('move.to.x');
          const toY = readVarGlobal('move.to.y');
          const fromPoint = readVarGlobal('move.from');
          const toPoint = readVarGlobal('move.to');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof fromX === 'number') next.properties.from = { ...next.properties.from, x: fromX };
          if (typeof fromY === 'number') next.properties.from = { ...next.properties.from, y: fromY };
          if (typeof toX === 'number') next.properties.to = { ...next.properties.to, x: toX };
          if (typeof toY === 'number') next.properties.to = { ...next.properties.to, y: toY };
          if (fromPoint && typeof fromPoint === 'object' && fromPoint !== null && 'x' in (fromPoint as any) && 'y' in (fromPoint as any)) {
            next.properties.from = { x: Number((fromPoint as any).x), y: Number((fromPoint as any).y) };
          }
          if (toPoint && typeof toPoint === 'object' && toPoint !== null && 'x' in (toPoint as any) && 'y' in (toPoint as any)) {
            next.properties.to = { x: Number((toPoint as any).x), y: Number((toPoint as any).y) };
          }
          return next;
        }
        case 'rotate': {
          const from = readVarGlobal('rotate.from');
          const to = readVarGlobal('rotate.to');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof from === 'number') next.properties.from = from;
          if (typeof to === 'number') next.properties.to = to;
          return next;
        }
        case 'scale': {
          const from = readVarGlobal('scale.from');
          const to = readVarGlobal('scale.to');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof from === 'number') next.properties.from = from;
          if (typeof to === 'number') next.properties.to = to;
          return next;
        }
        case 'fade': {
          const from = readVarGlobal('fade.from');
          const to = readVarGlobal('fade.to');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof from === 'number') next.properties.from = from;
          if (typeof to === 'number') next.properties.to = to;
          return next;
        }
        case 'color': {
          const from = readVarGlobal('color.from');
          const to = readVarGlobal('color.to');
          const prop = readVarGlobal('color.property');
          const next = { ...t, properties: { ...t.properties } } as typeof t;
          if (typeof from === 'string') next.properties.from = from;
          if (typeof to === 'string') next.properties.to = to;
          if (prop === 'fill' || prop === 'stroke') next.properties.property = prop;
          return next;
        }
        default:
          return t;
      }
    });

    const allAnimations: SceneAnimationTrack[] = [];
    const passThoughObjects: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);
    const outputCursorMap: Record<string, number> = { ...upstreamCursorMap };
    const perObjectAnimations: Record<string, SceneAnimationTrack[]> = this.extractPerObjectAnimationsFromInputs(inputs as unknown as ExecutionValue[]);
    const upstreamAssignments: PerObjectAssignments | undefined = this.extractPerObjectAssignmentsFromInputs(inputs as unknown as ExecutionValue[]);

    // Read node-level assignments stored on the Animation node itself
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

      for (const timedObject of inputData) {
        const objectId = (timedObject as { id?: unknown }).id as string | undefined;
        const appearanceTime = (timedObject as { appearanceTime?: unknown }).appearanceTime as number | undefined;
        let baseline: number;
        if (typeof objectId === 'string' && upstreamCursorMap[objectId] !== undefined) {
          baseline = upstreamCursorMap[objectId];
        } else {
          baseline = appearanceTime ?? 0;
        }
        // Only include prior animations from the current execution path
        const priorForObject = objectId ? (perObjectAnimations[objectId] ?? []) : [];
        const animations = convertTracksToSceneAnimations(
          (objectId ? resolvedTracks.map((t) => resolveTrackWithBindings(t, readVarForObject(objectId))) : resolvedTracks),
          objectId ?? '',
          baseline,
          priorForObject,
          mergedAssignments
        );

        if (objectId) {
          perObjectAnimations[objectId] = [...(perObjectAnimations[objectId] ?? []), ...animations];
        }

        allAnimations.push(...animations);
        passThoughObjects.push(timedObject);

        if (objectId) {
          const localEnd = animations.length > 0
            ? Math.max(...animations.map(a => a.startTime + a.duration))
            : baseline;
          const newCursor = animations.length > 0 ? localEnd : baseline;
          outputCursorMap[objectId] = Math.max(outputCursorMap[objectId] ?? 0, newCursor);
        }
      }
    }

    context.sceneAnimations.push(...allAnimations);

    // Track which Animation node created these animations
    const animationNodeId = node.data.identifier.id;
    for (const animation of allAnimations) {
      context.animationSceneMap.set(`${animation.id}_source`, animationNodeId);
    }
    const maxDuration = allAnimations.length > 0 ?
      Math.max(...allAnimations.map(a => a.startTime + a.duration), context.currentTime) :
      context.currentTime;
    context.currentTime = maxDuration;

    // Deep clone perObjectAnimations to prevent shared reference mutations
    const clonedPerObjectAnimations: Record<string, SceneAnimationTrack[]> = {};
    for (const [objectId, animations] of Object.entries(perObjectAnimations)) {
      clonedPerObjectAnimations[objectId] = animations.map((anim) => {
        switch (anim.type) {
          case 'move':
          case 'rotate':
          case 'scale':
          case 'fade':
          case 'color':
            return { ...anim, properties: { ...anim.properties } } as SceneAnimationTrack;
          default:
            return anim as SceneAnimationTrack;
        }
      });
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThoughObjects,
      { perObjectTimeCursor: outputCursorMap, perObjectAnimations: clonedPerObjectAnimations, perObjectAssignments: mergedAssignments }
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

  private extractPerObjectAnimationsFromInputs(inputs: ExecutionValue[]): Record<string, SceneAnimationTrack[]> {
    const merged: Record<string, SceneAnimationTrack[]> = {};
    for (const input of inputs) {
      const fromMeta = (input.metadata as { perObjectAnimations?: Record<string, SceneAnimationTrack[]> } | undefined)?.perObjectAnimations;
      if (!fromMeta) continue;
      for (const [objectId, animations] of Object.entries(fromMeta)) {
        merged[objectId] = [...(merged[objectId] ?? []), ...animations];
      }
    }
    return merged;
  }

  private extractPerObjectAssignmentsFromInputs(inputs: ExecutionValue[]): PerObjectAssignments | undefined {
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


