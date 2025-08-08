// src/server/jobs/render-queue.ts
import type { AnimationScene } from "@/shared/types/scene";
import type { SceneAnimationConfig as RendererSceneAnimationConfig } from "@/server/rendering/renderer";
import { CanvasRenderer } from "@/server/rendering/canvas-renderer";
import { LocalPublicStorageProvider } from "@/server/storage/local-public";
import { InMemoryQueue } from "./queue";

export interface RenderJobInput {
  scene: AnimationScene;
  config: RendererSceneAnimationConfig;
}

export interface RenderJobResult {
  publicUrl: string;
}

const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? "2");

const renderer = new CanvasRenderer(new LocalPublicStorageProvider({ subDir: "animations" }));

export const renderQueue = new InMemoryQueue<RenderJobInput, RenderJobResult>({
  concurrency: Number.isFinite(CONCURRENCY) && CONCURRENCY > 0 ? CONCURRENCY : 2,
  async handler(job): Promise<RenderJobResult> {
    const { publicUrl } = await renderer.render(job.scene, job.config);
    return { publicUrl };
  },
});


