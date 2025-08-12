// src/server/animation-processing/executors/animation-executor.ts
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { convertTracksToSceneAnimations, isPerObjectCursorMap, mergeCursorMaps } from "../scene/scene-assembler";
import { logger } from "@/lib/logger";

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

    const allAnimations: SceneAnimationTrack[] = [];
    const passThoughObjects: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);
    const outputCursorMap: Record<string, number> = { ...upstreamCursorMap };
    const perObjectAnimations: Record<string, SceneAnimationTrack[]> = this.extractPerObjectAnimationsFromInputs(inputs as unknown as ExecutionValue[]);

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
        // CRITICAL FIX: Only include prior animations from the current execution path
        // Don't include animations from other paths that happen to be in the global context
        const priorForObject = perObjectAnimations[objectId] ?? [];
        const animations = convertTracksToSceneAnimations(
          (data.tracks as AnimationTrack[]) || [],
          objectId ?? '',
          baseline,
          priorForObject
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

    // CRITICAL FIX: Deep clone perObjectAnimations to prevent shared reference mutations
    // This ensures that when data flows to multiple paths (direct to scene + through merge),
    // each path gets independent copies of animation data
    const clonedPerObjectAnimations: Record<string, SceneAnimationTrack[]> = {};
    for (const [objectId, animations] of Object.entries(perObjectAnimations)) {
      clonedPerObjectAnimations[objectId] = animations.map(anim => ({
        ...anim,
        properties: { ...anim.properties }
      }));
    }

    // DEBUG: Log what Animation 3 is creating and outputting
    if (node.data.identifier.displayName === "Animation 3") {
      logger.info(`[DEBUG] Animation 3 input tracks:`, {
        tracks: (data.tracks as AnimationTrack[])?.map(t => ({ 
          type: t.type, 
          properties: t.properties 
        })) || []
      });
      logger.info(`[DEBUG] Animation 3 created animations:`, {
        createdAnimations: allAnimations.map(a => ({
          type: a.type,
          objectId: a.objectId,
          properties: a.properties
        }))
      });
      logger.info(`[DEBUG] Animation 3 output:`, {
        objectId: Object.keys(clonedPerObjectAnimations)[0],
        animationTypes: Object.values(clonedPerObjectAnimations)[0]?.map(a => a.type) || [],
        animationCount: Object.values(clonedPerObjectAnimations)[0]?.length || 0,
        hasColor: Object.values(clonedPerObjectAnimations)[0]?.some(a => a.type === 'color') || false,
        hasMove: Object.values(clonedPerObjectAnimations)[0]?.some(a => a.type === 'move') || false
      });
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThoughObjects,
      { perObjectTimeCursor: outputCursorMap, perObjectAnimations: clonedPerObjectAnimations }
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
}


