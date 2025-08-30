// src/server/rendering/image/image-renderer.ts
import { createCanvas } from "canvas";
import type { AnimationScene } from "@/shared/types/scene";
import {
  SceneRenderer,
  type SceneRenderConfig,
} from "@/animation/execution/scene-renderer";
import type { StorageProvider } from "@/server/storage/provider";
import fs from "fs";

export interface ImageRenderConfig {
  width: number;
  height: number;
  backgroundColor: string;
  format: "png" | "jpeg";
  quality?: number; // 1-100 for jpeg
  time?: number; // optional snapshot time; default 0
  // Optional output naming/location
  outputBasename?: string;
  outputSubdir?: string;
}

// Proper type for jpeg config
interface JpegConfig {
  quality: number;
}

export class ImageRenderer {
  private readonly storageProvider: StorageProvider;

  constructor(storageProvider: StorageProvider) {
    this.storageProvider = storageProvider;
  }

  async render(
    scene: AnimationScene,
    cfg: ImageRenderConfig,
  ): Promise<{ filePath: string; publicUrl: string }> {
    const canvas = createCanvas(cfg.width, cfg.height);
    const ctx = canvas.getContext("2d");

    const renderConfig: SceneRenderConfig = {
      width: cfg.width,
      height: cfg.height,
      backgroundColor: cfg.backgroundColor,
    };

    const sceneRenderer = new SceneRenderer(scene, renderConfig);

    try {
      await sceneRenderer.renderFrame(ctx as never, cfg.time ?? 0);

      const prepared = await this.storageProvider.prepareTarget(cfg.format, {
        basename: cfg.outputBasename,
        subdir: cfg.outputSubdir,
        allowUpsert: false,
      });

      try {
        const buffer =
          cfg.format === "png"
            ? canvas.toBuffer("image/png")
            : canvas.toBuffer("image/jpeg", {
                quality: Math.max(0, Math.min(1, (cfg.quality ?? 90) / 100)),
              } as JpegConfig);

        await fs.promises.writeFile(prepared.filePath, buffer);
        const { publicUrl } = await this.storageProvider.finalize(prepared, {
          contentType: cfg.format === "png" ? "image/png" : "image/jpeg",
        } as never);
        return { filePath: prepared.filePath, publicUrl };
      } finally {
        // no explicit dispose required for prepared target
      }
    } finally {
      // ✅ CRITICAL FIX: Dispose SceneRenderer to clear image cache
      sceneRenderer.dispose();
    }
  }
}
