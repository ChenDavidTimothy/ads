// src/server/jobs/render-queue.ts
import type { AnimationScene } from "@/shared/types/scene";
import type { SceneAnimationConfig as RendererSceneAnimationConfig } from "@/server/rendering/renderer";
import { CanvasRenderer } from "@/server/rendering/canvas-renderer";
import { SupabaseStorageProvider } from "@/server/storage/supabase";
import { createServiceClient } from "@/utils/supabase/service";
import { InMemoryQueue } from "./queue";

export interface RenderJobInput {
  scene: AnimationScene;
  config: RendererSceneAnimationConfig;
  userId: string;
  jobId: string;
}

export interface RenderJobResult {
  publicUrl: string;
}

const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? "2");

export const renderQueue = new InMemoryQueue<RenderJobInput, RenderJobResult>({
  concurrency: Number.isFinite(CONCURRENCY) && CONCURRENCY > 0 ? CONCURRENCY : 2,
  async handler(job): Promise<RenderJobResult> {
    const supabase = createServiceClient();
    try {
      await supabase
        .from("render_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.jobId)
        .eq("user_id", job.userId);

      const storage = new SupabaseStorageProvider(job.userId);
      const renderer = new CanvasRenderer(storage);
      const { publicUrl } = await renderer.render(job.scene, job.config);

      await supabase
        .from("render_jobs")
        .update({ status: "completed", output_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", job.jobId)
        .eq("user_id", job.userId);

      return { publicUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("render_jobs")
        .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
        .eq("id", job.jobId)
        .eq("user_id", job.userId);
      throw err;
    }
  },
});


