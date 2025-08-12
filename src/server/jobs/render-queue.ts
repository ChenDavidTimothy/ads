// src/server/jobs/render-queue.ts
import type { AnimationScene } from "@/shared/types/scene";
import type { SceneAnimationConfig as RendererSceneAnimationConfig } from "@/server/rendering/renderer";
import { PgBossQueue } from './pgboss-queue';

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
  return; // no-op in event-driven system
}

export const renderQueue = new PgBossQueue<RenderJobInput, RenderJobResult>({
  queueName: 'render-video',
});