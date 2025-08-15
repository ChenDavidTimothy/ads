// src/server/animation-processing/executors/animation-executor.ts
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { convertTracksToSceneAnimations, isPerObjectCursorMap, mergeCursorMaps } from "../scene/scene-assembler";
import type { PerObjectAssignments } from "@/shared/properties/assignments";
import { mergeObjectAssignments, type ObjectAssignments } from "@/shared/properties/assignments";
import { setByPath } from "@/shared/utils/object-path";

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

    // DEBUG: Log input animations at start
    const inputAnimations = this.extractPerObjectAnimationsFromInputs(inputs as unknown as ExecutionValue[]);
    console.log(`[${node.data.identifier.displayName}] INPUT ANIMATIONS:`, {
      nodeId: node.data.identifier.id,
      inputAnimations: Object.entries(inputAnimations)
        .map(([objId, tracks]) => ({
          objectId: objId,
          trackCount: tracks.length,
          trackIds: tracks.map(t => t.id),
          trackTypes: tracks.map(t => t.type)
        }))
    });

    // DEBUG: Check if Animation1 node actually has tracks defined
    const tracks = (data.tracks as AnimationTrack[]) || [];
    console.log(`[${node.data.identifier.displayName}] Track count: ${tracks.length}`);
    if (tracks.length === 0) {
      console.log(`[${node.data.identifier.displayName}] ERROR: No tracks defined on this animation node!`);
    }

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

    // Build a list of binding keys to apply at global level
    const globalBindingKeys = Object.keys(bindings);

    // Clone tracks and apply generic per-track bindings using key prefixes
    const originalTracks: AnimationTrack[] = (data.tracks as AnimationTrack[]) || [];

    const applyBindingsToTrack = (t: AnimationTrack, keys: string[], reader: (k: string) => unknown): AnimationTrack => {
      // Copy track and properties
      const next = { ...t, properties: { ...t.properties } } as AnimationTrack;

      const typePrefix = `${t.type}.`;
      const trackTypePrefix = `track.${t.identifier.id}.${t.type}.`;
      const trackScalarPrefix = `track.${t.identifier.id}.`;

      // 1) Apply type-level keys (affect all tracks of this type)
      for (const key of keys) {
        if (!key.startsWith(typePrefix)) continue;
        const subPath = key.slice(typePrefix.length);
        const val = reader(key);
        if (val === undefined) continue;
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
        setByPath(next.properties as unknown as Record<string, unknown>, subPath, val);
      }

      // 2) Apply track-specific keys (override type-level)
      for (const key of keys) {
        if (key.startsWith(trackTypePrefix)) {
          const subPath = key.slice(trackTypePrefix.length);
          const val = reader(key);
          if (val === undefined) continue;
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
          setByPath(next.properties as unknown as Record<string, unknown>, subPath, val);
          continue;
        }
        // Also support scalar track keys like track.<id>.duration, track.<id>.easing
        if (key.startsWith(trackScalarPrefix)) {
          const sub = key.slice(trackScalarPrefix.length);
          const val = reader(key);
          if (val === undefined) continue;
          if (sub === 'easing') {
            (next as any).easing = val as any;
            continue;
          }
          if (sub === 'startTime' && typeof val === 'number') {
            (next as any).startTime = val as number;
            continue;
          }
          if (sub === 'duration' && typeof val === 'number') {
            (next as any).duration = val as number;
            continue;
          }
        }
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
          outputCursorMap[objectId] = Math.max(outputCursorMap[objectId] ?? 0, localEnd);
        }
      }
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThoughObjects,
      { perObjectTimeCursor: outputCursorMap, perObjectAnimations: this.clonePerObjectAnimations(perObjectAnimations), perObjectAssignments: mergedAssignments }
    );

    // DEBUG: Log output metadata at end
    console.log(`[${node.data.identifier.displayName}] OUTPUT METADATA:`, {
      nodeId: node.data.identifier.id,
      perObjectTimeCursor: outputCursorMap,
      perObjectAnimations: Object.entries(this.clonePerObjectAnimations(perObjectAnimations))
        .map(([objId, tracks]) => ({
          objectId: objId,
          trackCount: tracks.length,
          trackIds: tracks.map(t => t.id),
          trackTypes: tracks.map(t => t.type)
        })),
      perObjectAssignments: mergedAssignments
    });
  }

  private clonePerObjectAnimations(map: Record<string, SceneAnimationTrack[]>): Record<string, SceneAnimationTrack[]> {
    const cloned: Record<string, SceneAnimationTrack[]> = {};
    for (const [k, v] of Object.entries(map)) {
      cloned[k] = v.map((t) => ({ ...t, properties: JSON.parse(JSON.stringify(t.properties)) }));
    }
    return cloned;
  }

  private extractPerObjectAnimationsFromInputs(inputs: ExecutionValue[]): Record<string, SceneAnimationTrack[]> {
    const merged: Record<string, SceneAnimationTrack[]> = {};
    for (const input of inputs) {
      const perObj = (input.metadata as { perObjectAnimations?: Record<string, SceneAnimationTrack[]> } | undefined)?.perObjectAnimations;
      if (!perObj) continue;
      for (const [objectId, tracks] of Object.entries(perObj)) {
        const list = merged[objectId] ?? [];
        merged[objectId] = [...list, ...tracks];
      }
    }
    return merged;
  }

  private extractCursorsFromInputs(inputs: ExecutionValue[]): Record<string, number> {
    const maps: Record<string, number>[] = [];
    for (const input of inputs) {
      const cursors = (input.metadata as { perObjectTimeCursor?: Record<string, number> } | undefined)?.perObjectTimeCursor;
      if (cursors) maps.push(cursors);
    }
    if (maps.length === 0) return {};
    return mergeCursorMaps(maps);
  }

  private extractPerObjectAssignmentsFromInputs(inputs: ExecutionValue[]): PerObjectAssignments | undefined {
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


