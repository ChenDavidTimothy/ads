// src/server/animation-processing/executors/animation-executor.ts
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { convertTracksToSceneAnimations, isPerObjectCursorMap, mergeCursorMaps } from "../scene/scene-assembler";

export class AnimationNodeExecutor extends BaseExecutor {
  // Register animation node handlers
  protected registerHandlers(): void {
    this.registerHandler('animation', this.executeAnimation.bind(this));
    this.registerHandler('canvas', this.executeCanvas.bind(this));
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
        // Previously: context.sceneAnimations.filter(a => a.objectId === objectId)
        // Problem: This included animations from parallel execution paths, causing interference
        // Solution: Only consider animations from the current path's metadata
        const priorForObject = objectId ? (perObjectAnimations[objectId] ?? []) : [];
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
    // Problem: Animation data was shared by reference between different execution paths
    // When merge nodes processed animations, they modified the same objects used by direct scene connections
    // Solution: Clone animation data before passing in metadata to ensure data independence
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
      { perObjectTimeCursor: outputCursorMap, perObjectAnimations: clonedPerObjectAnimations }
    );
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

    const passThrough: unknown[] = [];

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const obj of inputData) {
        if (typeof obj === 'object' && obj !== null && 'id' in obj) {
          const original = obj as Record<string, unknown>;
          const initialPosition = (data.position as { x: number; y: number }) ?? (original.initialPosition as { x: number; y: number });
          const initialRotation = (data.rotation as number) ?? (original.initialRotation as number) ?? 0;
          const initialScale = (data.scale as { x: number; y: number }) ?? (original.initialScale as { x: number; y: number }) ?? { x: 1, y: 1 };
          const initialOpacity = (data.opacity as number) ?? (original.initialOpacity as number) ?? 1;

          // Override colors if provided
          const properties = { ...(original.properties as Record<string, unknown>) };
          if (typeof data.fillColor === 'string') properties.color = data.fillColor;
          if (typeof data.strokeColor === 'string') properties.strokeColor = data.strokeColor;
          if (typeof data.strokeWidth === 'number') properties.strokeWidth = data.strokeWidth;

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

    // Pass through existing per-object animations/cursors unchanged
    const firstMeta = inputs[0]?.metadata as { perObjectTimeCursor?: Record<string, number>; perObjectAnimations?: Record<string, SceneAnimationTrack[]> } | undefined;

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThrough,
      {
        perObjectTimeCursor: firstMeta?.perObjectTimeCursor,
        perObjectAnimations: firstMeta?.perObjectAnimations,
      }
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


