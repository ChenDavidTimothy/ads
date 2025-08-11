// src/server/animation-processing/executors/animation-executor.ts
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { convertTracksToSceneAnimations, isPerObjectCursorMap, mergeCursorMaps } from "../scene/scene-assembler";
import { transformFactory } from "@/shared/registry/transforms";

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
        // Include prior animations already present in the overall context for this object
        const priorForObject = context.sceneAnimations.filter(a => a.objectId === (objectId ?? ''));
        const animations = convertTracksToSceneAnimations(
          (data.tracks as AnimationTrack[]) || [],
          objectId ?? '',
          baseline,
          priorForObject
        );
        
        // Attach animations to the object and PRESERVE any previously attached animations
        const previouslyAttached = Array.isArray((timedObject as Record<string, unknown>)._attachedAnimations)
          ? ((timedObject as Record<string, unknown>)._attachedAnimations as unknown[])
          : [];
        const animatedObject = {
          ...(timedObject as Record<string, unknown>),
          _attachedAnimations: [...previouslyAttached, ...animations]
        };
        
        allAnimations.push(...animations);
        passThoughObjects.push(animatedObject);

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
}


