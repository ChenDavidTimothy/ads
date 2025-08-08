// src/server/jobs/render-queue.ts
import type { AnimationScene } from "@/shared/types/scene";
import type { SceneAnimationConfig as RendererSceneAnimationConfig } from "@/server/rendering/renderer";
import { CanvasRenderer } from "@/server/rendering/canvas-renderer";
import { SupabaseStorageProvider } from "@/server/storage/supabase";
import { createServiceClient } from "@/utils/supabase/service";
import { PgBossQueue } from './pgboss-queue';
import { registerRenderWorker } from './render-worker';

export interface RenderJobInput {
  scene: AnimationScene;
  config: RendererSceneAnimationConfig;
  userId: string;
  jobId: string;
}

export interface RenderJobResult {
  publicUrl: string;
}

// Ensure worker is registered once in process, and export a helper to await it
const workerReady: Promise<void> = registerRenderWorker();

export async function ensureWorkerReady(): Promise<void> {
  await workerReady;
}

export const renderQueue = new PgBossQueue<RenderJobInput, RenderJobResult>({
  queueName: 'render-video',
});


