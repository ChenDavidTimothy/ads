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

    // Helper: deep set utility for applying bindings by path
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

    // Build a list of binding keys to apply at global level
    const globalBindingKeys = Object.keys(bindings);

    // Clone tracks and apply generic per-track bindings using key prefixes
    const originalTracks: AnimationTrack[] = (data.tracks as AnimationTrack[]) || [];

    const applyBindingsToTrack = (t: AnimationTrack, keys: string[], reader: (k: string) => unknown): AnimationTrack => {
      // Copy track and properties
      const next = { ...t, properties: { ...t.properties } } as AnimationTrack;
      for (const key of keys) {
        const prefix = `${t.type}.`;
        if (!key.startsWith(prefix)) continue;
        const subPath = key.slice(prefix.length);
        const val = reader(key);
        if (val === undefined) continue;
        // Apply to properties when targeting property fields; allow 'easing', 'startTime', 'duration' via special cases
        if (subPath === 'easing') {
          (next as any).easing = val as any;
          continue;
        }
        if (subPath === 'startTime' && typeof val === 'number') {
          (next as any).startTime = val as number;
          continue;
        }
        if (subPath === 'duration' && typeof val === 'number') {
          (next as any).duration = val as number;
          continue;
        }
        // Otherwise set on properties via path (supports e.g., 'from', 'to', 'from.x', 'property')
        setByPath(next.properties as unknown as Record<string, unknown>, subPath, val);
      }
      return next;
    };

    // First, apply global bindings once
    const resolvedTracks: AnimationTrack[] = originalTracks.map((t) => applyBindingsToTrack(t, globalBindingKeys, readVarGlobal));

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

        // Apply per-object bindings if present
        const objectBindingKeys = objectId ? Object.keys(bindingsByObject[objectId] ?? {}) : [];
        const objectReader = readVarForObject(objectId);
        const resolvedForObject = objectId ? resolvedTracks.map((t) => applyBindingsToTrack(t, objectBindingKeys, objectReader)) : resolvedTracks;

        const animations = convertTracksToSceneAnimations(
          resolvedForObject,
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


