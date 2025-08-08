// src/server/jobs/render-queue.ts
import type { AnimationScene } from "@/shared/types/scene";
import type { SceneAnimationConfig as RendererSceneAnimationConfig } from "@/server/rendering/renderer";
// Imports retained if needed by future extensions; not used directly here.
// import { CanvasRenderer } from "@/server/rendering/canvas-renderer";
// import { SupabaseStorageProvider } from "@/server/storage/supabase";
// import { createServiceClient } from "@/utils/supabase/service";
import { PgBossQueue } from './pgboss-queue';
// Note: worker is decoupled and must be run in a separate process.

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
  return; // no-op
}

export const renderQueue = new PgBossQueue<RenderJobInput, RenderJobResult>({
  queueName: 'render-video',
});


