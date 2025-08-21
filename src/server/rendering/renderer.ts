// src/server/rendering/renderer.ts
import type { AnimationScene } from "@/shared/types/scene";

export interface SceneAnimationConfig {
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  videoPreset: string;
  videoCrf: number;
}

export const DEFAULT_SCENE_CONFIG: SceneAnimationConfig = {
  width: 1920,
  height: 1080,
  fps: 60,
  backgroundColor: "#000000",
  videoPreset: "medium",
  videoCrf: 18,
};

export interface RenderOutput {
  // Absolute filesystem path where the video was written
  filePath: string;
  // Public URL where the video can be accessed by clients
  publicUrl: string;
}

export interface Renderer {
  render(
    scene: AnimationScene,
    config: SceneAnimationConfig,
  ): Promise<RenderOutput>;
}
