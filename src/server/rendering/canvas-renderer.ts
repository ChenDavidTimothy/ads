// src/server/rendering/canvas-renderer.ts
import type { AnimationScene } from "@/shared/types/scene";
import { FrameGenerator, type FrameConfig } from "@/animation/renderer/frame-generator";
import { SceneRenderer, type SceneRenderConfig } from "@/animation/execution/scene-renderer";
import { linear } from "@/animation/core/interpolation";
import type { Renderer, SceneAnimationConfig, RenderOutput } from "./renderer";
import type { StorageProvider } from "@/server/storage/provider";

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

    const { filePath, publicUrl } = await this.storageProvider.prepareTarget("mp4");

    await frameGenerator.generateAnimation(
      filePath,
      (ctx, frame) => {
        sceneRenderer.renderFrame(ctx, frame.time);
      },
      {
        preset: config.videoPreset,
        crf: config.videoCrf,
      }
    );

    return { filePath, publicUrl };
  }
}


