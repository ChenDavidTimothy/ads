// src/animation/renderer/frame-generator.ts
import { createCanvas } from 'canvas';
import type { NodeCanvasContext, EasingFunction } from '../types';
import { VideoEncoder, convertImageDataToRGB, type VideoConfig } from './video-encoder';
import { linear } from '../core/interpolation';

export interface FrameConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  backgroundColor: string;
}

export interface AnimationFrame {
  progress: number;
  easedProgress: number;
  frameNumber: number;
  time: number;
}

export type RenderCallback = (
  ctx: NodeCanvasContext,
  frame: AnimationFrame,
  config: FrameConfig
) => void;

export class FrameGenerator {
  private config: FrameConfig;
  private easingFunction: EasingFunction;
  private canvas: ReturnType<typeof createCanvas>;
  private ctx: NodeCanvasContext;

  constructor(config: FrameConfig, easingFunction: EasingFunction = linear) {
    this.config = config;
    this.easingFunction = easingFunction;
    this.canvas = createCanvas(config.width, config.height);
    this.ctx = this.canvas.getContext('2d') as unknown as NodeCanvasContext;
  }

  async generateAnimation(
    outputPath: string,
    renderCallback: RenderCallback,
    videoConfig?: Partial<VideoConfig>
  ): Promise<string> {
    const totalFrames = this.config.fps * this.config.duration;

    const encoder = new VideoEncoder(outputPath, {
      width: this.config.width,
      height: this.config.height,
      fps: this.config.fps,
      preset: videoConfig?.preset ?? 'medium',
      crf: videoConfig?.crf ?? 18
    });

    try {
      await encoder.start();

      for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
        const progress = frameNumber / (totalFrames - 1);
        const easedProgress = this.easingFunction(progress);
        const time = progress * this.config.duration;

        const frame: AnimationFrame = {
          progress,
          easedProgress,
          frameNumber,
          time
        };

        // Clear canvas
        this.clearCanvas();

        // Render frame
        renderCallback(this.ctx, frame, this.config);

        // Convert to RGB and write
        const imageData = this.ctx.getImageData(0, 0, this.config.width, this.config.height);
        const rgbBuffer = convertImageDataToRGB(imageData as ImageData, this.config.width, this.config.height);
        await encoder.writeFrame(rgbBuffer);
      }

      await encoder.finish();
      return outputPath;
    } catch (error) {
      encoder.kill();
      throw error;
    }
  }

  generateFrames(renderCallback: RenderCallback): ImageData[] {
    const totalFrames = this.config.fps * this.config.duration;
    const frames: ImageData[] = [];

    for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
      const progress = frameNumber / (totalFrames - 1);
      const easedProgress = this.easingFunction(progress);
      const time = progress * this.config.duration;

      const frame: AnimationFrame = {
        progress,
        easedProgress,
        frameNumber,
        time
      };

      this.clearCanvas();
      renderCallback(this.ctx, frame, this.config);

      const imageData = this.ctx.getImageData(0, 0, this.config.width, this.config.height);
      frames.push(imageData as ImageData);
    }

    return frames;
  }

  private clearCanvas(): void {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.config.width, this.config.height);
  }

  getCanvas(): ReturnType<typeof createCanvas> {
    return this.canvas;
  }

  getContext(): NodeCanvasContext {
    return this.ctx;
  }

  setEasing(easingFunction: EasingFunction): void {
    this.easingFunction = easingFunction;
  }
}