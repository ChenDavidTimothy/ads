// src/lib/flow/transform-tracking.ts - Tracks transform lineage within an animation node
import type { TransformLineage } from '@/shared/types/transforms';

export class TransformTracker {
  private readonly transformLineages = new Map<string, TransformLineage>();

  trackTransformCreation(transformId: string, animationNodeId: string, trackIndex: number): void {
    this.transformLineages.set(transformId, {
      animationNodeId,
      trackIndex,
      dependencies: [],
    });
  }

  updateTrackIndex(transformId: string, newIndex: number): void {
    const lineage = this.transformLineages.get(transformId);
    if (lineage) {
      lineage.trackIndex = newIndex;
    }
  }

  updateTransformDependencies(transformId: string, dependencies: string[]): void {
    const lineage = this.transformLineages.get(transformId);
    if (lineage) {
      lineage.dependencies = [...dependencies];
    }
  }

  removeTransform(transformId: string): void {
    this.transformLineages.delete(transformId);
    // Remove from others' dependencies
    for (const lineage of this.transformLineages.values()) {
      lineage.dependencies = lineage.dependencies.filter((d) => d !== transformId);
    }
  }

  getTransformsByAnimationNode(animationNodeId: string): string[] {
    return Array.from(this.transformLineages.entries())
      .filter(([, lineage]) => lineage.animationNodeId === animationNodeId)
      .map(([id]) => id);
  }
}
