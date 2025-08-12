// src/server/jobs/render-queue.ts
import type { AnimationScene } from "@/shared/types/scene";
import type { SceneAnimationConfig as RendererSceneAnimationConfig } from "@/server/rendering/renderer";
import { GraphileQueue } from './graphile-queue';

export interface RenderJobInput {
  scene: AnimationScene;
  config: RendererSceneAnimationConfig;
  userId: string;
  jobId: string;
}

export interface RenderJobResult {
  publicUrl: string;
}

// Worker readiness is managed by a separate worker process.
export async function ensureWorkerReady(): Promise<void> {
  return; // Graphile worker runner handles readiness separately
}

export const renderQueue = new GraphileQueue<RenderJobInput, RenderJobResult>({
  taskIdentifier: 'render-video',
});