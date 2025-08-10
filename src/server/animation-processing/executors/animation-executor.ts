// src/server/animation-processing/executors/animation-executor.ts
import type { NodeData, AnimationTrack, SceneAnimationTrack, PropertyOverrides, AnimationNodeData } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { convertTracksToSceneAnimations, isPerObjectCursorMap, mergeCursorMaps, extractObjectIdsFromInputs } from "../scene/scene-assembler";
import { getTrackRegistryEntry } from "@/shared/registry/track-registry";

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
    const data = node.data as unknown as AnimationNodeData;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    const allAnimations: SceneAnimationTrack[] = [];
    const passThoughObjects: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);
    const outputCursorMap: Record<string, number> = { ...upstreamCursorMap };

    // Flatten inputs into arrays we can index consistently
    const allObjects: Array<Record<string, unknown>> = [];
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const timedObject of inputData) {
        const objectId = (timedObject as { id?: unknown }).id as string | undefined;
        if (!objectId) continue;
        allObjects.push(timedObject as Record<string, unknown>);
      }
    }
    const allObjectIds: string[] = extractObjectIdsFromInputs(inputs as unknown as Array<{ data: unknown }>);

    // Pre-resolve overrides keyed by objectId -> array of { trackId, key, value }
    const resolvedOverrideMap = this.preResolveOverrides(
      data.propertyOverrides ?? {},
      allObjectIds,
      undefined // Phase 2: result node outputs
    );

    for (let i = 0; i < allObjects.length; i++) {
      const timedObject = allObjects[i]!;
      const objectId = allObjectIds[i]!;

      const appearanceTime = (timedObject as { appearanceTime?: unknown }).appearanceTime as number | undefined;
      const baseline = upstreamCursorMap[objectId] !== undefined ? upstreamCursorMap[objectId]! : (appearanceTime ?? 0);

      const processedTracks = this.applyResolvedOverrides(
        data.tracks || [],
        objectId,
        resolvedOverrideMap[objectId] || []
      );

      const animations = convertTracksToSceneAnimations(
        processedTracks,
        objectId,
        baseline
      );

      const animatedObject = {
        ...timedObject,
        _attachedAnimations: animations,
      };

      allAnimations.push(...animations);
      passThoughObjects.push(animatedObject);

      const localEnd = animations.length > 0
        ? Math.max(...animations.map(a => a.startTime + a.duration))
        : baseline;
      const newCursor = animations.length > 0 ? localEnd : baseline;
      outputCursorMap[objectId] = Math.max(outputCursorMap[objectId] ?? 0, newCursor);
    }

    context.sceneAnimations.push(...allAnimations);
    
    // Track which Animation node created these animations
    // This allows proper assignment to only downstream scenes
    const animationNodeId = node.data.identifier.id;
    for (const animation of allAnimations) {
      const animationId = `${animation.objectId}-${animation.type}-${animation.startTime}`;
      // Store which animation node created this animation
      context.animationSceneMap.set(`${animationId}_source`, animationNodeId);
    }
    const maxDuration = allAnimations.length > 0 ?
      Math.max(...allAnimations.map(a => a.startTime + a.duration), context.currentTime) :
      context.currentTime;
    context.currentTime = maxDuration;

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThoughObjects,
      { perObjectTimeCursor: outputCursorMap }
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

  // ---------- Overrides helpers ----------
  private preResolveOverrides(
    overrides: PropertyOverrides,
    objectIds: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resultNodeOutputs?: Map<string, Record<string, unknown>>
  ): Record<string, Array<{ trackId: string; propertyKey: string; value: unknown }>> {
    const map: Record<string, Array<{ trackId: string; propertyKey: string; value: unknown }>> = {};
    for (const objectId of objectIds) map[objectId] = [];

    for (const [trackId, perProp] of Object.entries(overrides)) {
      for (const [propertyKey, entry] of Object.entries(perProp)) {
        for (const [objectId, source] of Object.entries(entry.overrides)) {
          if (!(objectId in map)) continue;
          if (source.type === 'manual') {
            map[objectId]!.push({ trackId, propertyKey, value: source.value });
          } else if (source.type === 'resultNode') {
            // Phase 2: result node lookup; placeholder for now
            const value = undefined; // resultNodeOutputs?.get(source.id)?.[objectId]
            if (value !== undefined) {
              map[objectId]!.push({ trackId, propertyKey, value });
            }
          }
        }
      }
    }
    return map;
  }

  private applyResolvedOverrides(
    tracks: AnimationTrack[],
    objectId: string,
    resolved: Array<{ trackId: string; propertyKey: string; value: unknown }>
  ): AnimationTrack[] {
    if (resolved.length === 0) return tracks;
    const next: AnimationTrack[] = tracks.map(t => ({ ...t, properties: { ...(t as any).properties } }));

    for (const override of resolved) {
      const index = next.findIndex(t => t.id === override.trackId);
      if (index === -1) continue;
      const track = next[index]!;
      const entry = getTrackRegistryEntry(track.type);
      if (!entry) continue;
      // Support nested property keys like 'from.x'
      const propKey = override.propertyKey;
      const baseSchemaKey = propKey.includes('.') ? propKey.split('.')[0]! : propKey;
      const schema = entry.properties.find(p => p.key === baseSchemaKey);
      if (!schema) continue;
      if (propKey.includes('.')) {
        const [baseKey, ...rest] = propKey.split('.');
        let target: any = (track as any).properties[baseKey!];
        if (target && typeof target === 'object') {
          // Only support one-level deep for now (x or y)
          if (rest.length === 1) {
            target[rest[0]!] = override.value;
          }
        }
      } else {
        (track as any).properties[propKey] = override.value as never;
      }
      next[index] = track;
    }
    return next;
  }
}


