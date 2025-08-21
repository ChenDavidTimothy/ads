// src/server/rendering/canvas-renderer.ts
import type { AnimationScene } from "@/shared/types/scene";
import { FrameGenerator, type FrameConfig } from "@/animation/renderer/frame-generator";
import { SceneRenderer, type SceneRenderConfig } from "@/animation/execution/scene-renderer";
import { linear } from "@/animation/core/interpolation";
import type { Renderer, SceneAnimationConfig, RenderOutput } from "./renderer";
import type { StorageProvider } from "@/server/storage/provider";

// Extended interface for storage providers that support cleanup
interface CleanupableStorageProvider extends StorageProvider {
  cleanup(): Promise<void>;
}

// Type guard to check if storage provider supports cleanup
function supportsCleanup(provider: StorageProvider): provider is CleanupableStorageProvider {
  return typeof (provider as CleanupableStorageProvider).cleanup === 'function';
}

export class CanvasRenderer implements Renderer {
  private readonly storageProvider: StorageProvider;

  constructor(storageProvider: StorageProvider) {
    this.storageProvider = storageProvider;
  }

  async render(scene: AnimationScene, config: SceneAnimationConfig): Promise<RenderOutput> {
    const frameConfig: FrameConfig = {
      width: config.width,
      height: config.height,
      fps: config.fps,
      duration: scene.duration,
      backgroundColor: config.backgroundColor,
    };

    const sceneRenderConfig: SceneRenderConfig = {
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
    };

    const sceneRenderer = new SceneRenderer(scene, sceneRenderConfig);
    const frameGenerator = new FrameGenerator(frameConfig, linear);

    const prepared = await this.storageProvider.prepareTarget("mp4");

    try {
      await frameGenerator.generateAnimation(
        prepared.filePath,
        async (ctx, frame) => {
          await sceneRenderer.renderFrame(ctx, frame.time);
        },
        {
          preset: config.videoPreset,
          crf: config.videoCrf,
        }
      );

      const { publicUrl } = await this.storageProvider.finalize(prepared);
      return { filePath: prepared.filePath, publicUrl };
    } finally {
      // ✅ CRITICAL FIX: Dispose SceneRenderer to clear image cache
      sceneRenderer.dispose();
      frameGenerator.dispose();
      
      if (supportsCleanup(this.storageProvider)) {
        await this.storageProvider.cleanup();
      }
    }
  }
}
