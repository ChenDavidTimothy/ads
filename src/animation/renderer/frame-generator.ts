// src/animation/renderer/frame-generator.ts
import { createCanvas } from 'canvas';
import type { NodeCanvasContext, EasingFunction } from '@/shared/types/core';
import { VideoEncoder, type VideoConfig } from './video-encoder';
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
) => void | Promise<void>;

interface WatchdogConfig {
  maxRenderMs: number; // total render time limit
  maxHeapUsedBytes: number; // heap usage limit
  sampleIntervalMs: number;
}

import { RENDER_WATCHDOG as GLOBAL_WATCHDOG } from '@/server/rendering/config';

const DEFAULT_WATCHDOG: WatchdogConfig = GLOBAL_WATCHDOG;

export class FrameGenerator {
  private config: FrameConfig;
  private easingFunction: EasingFunction;
  private canvas: ReturnType<typeof createCanvas>;
  private ctx: NodeCanvasContext;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private watchdogError: Error | null = null;

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
      crf: videoConfig?.crf ?? 18,
      // node-canvas raw buffer is BGRA; feed that directly to ffmpeg
      inputPixelFormat: 'bgra',
    });

    const startedAt = Date.now();
    const watchdogCfg = DEFAULT_WATCHDOG;

    try {
      await encoder.start();

      // Start watchdog for time and memory. Do not throw here; set flag checked in loop
      this.startWatchdog(() => {
        const elapsed = Date.now() - startedAt;
        const mem = process.memoryUsage();
        if (!this.watchdogError && elapsed > watchdogCfg.maxRenderMs) {
          this.watchdogError = new Error(`Render exceeded max duration ${watchdogCfg.maxRenderMs}ms`);
        }
        if (!this.watchdogError && mem.heapUsed > watchdogCfg.maxHeapUsedBytes) {
          this.watchdogError = new Error(`Render exceeded heap usage ${(watchdogCfg.maxHeapUsedBytes / (1024 * 1024)).toFixed(0)}MB`);
        }
      }, watchdogCfg.sampleIntervalMs);

      for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
        if (this.watchdogError) {
          encoder.kill();
          throw this.watchdogError;
        }

        const progress = frameNumber / (totalFrames - 1);
        const easedProgress = this.easingFunction(progress);
        const time = progress * this.config.duration;

        const frame: AnimationFrame = {
          progress,
          easedProgress,
          frameNumber,
          time
        };

        // Render frame (SceneRenderer handles its own canvas clearing)
        await renderCallback(this.ctx, frame, this.config);

        // Debug: Check canvas state before buffer capture
        console.log(`[FRAME-GEN] Frame ${frameNumber}: Canvas context state before buffer capture`);
        if ('getTransform' in this.ctx) {
          const matrix = this.ctx.getTransform();
          console.log(`[FRAME-GEN] Frame ${frameNumber}: Transform matrix:`, matrix.toString());
        }

        // Write raw RGBA directly
        const rgbaBuffer = this.canvas.toBuffer('raw');
        console.log(`[FRAME-GEN] Frame ${frameNumber}: Buffer size:`, rgbaBuffer.length, 'bytes');
        await encoder.writeFrame(rgbaBuffer);
        
        // Reset canvas context for next frame to prevent state corruption
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
      }

      if (this.watchdogError) {
        encoder.kill();
        throw this.watchdogError;
      }

      await encoder.finish();
      return outputPath;
    } catch (error) {
      encoder.kill();
      throw error;
    } finally {
      this.stopWatchdog();
      // watchdogError is already null by default, no need to reassign
    }
  }

  async generateFrames(renderCallback: RenderCallback): Promise<ImageData[]> {
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

      // SceneRenderer handles its own canvas clearing
      await renderCallback(this.ctx, frame, this.config);

      const imageData = this.ctx.getImageData(0, 0, this.config.width, this.config.height);
      frames.push(imageData as ImageData);
    }

    return frames;
  }

  private startWatchdog(check: () => void, intervalMs: number): void {
    this.stopWatchdog();
    this.watchdogTimer = setInterval(() => {
      try {
        check();
      } catch (err) {
        // Do not throw beyond the interval; rely on flag and outer loop checks
        this.watchdogError ??= err instanceof Error ? err : new Error(String(err));
      }
    }, intervalMs);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
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

  dispose(): void {
    // Release references to allow GC
    // node-canvas does not require explicit destroy, but nulling helps GC on long runs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.ctx as any) = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.canvas as any) = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.config as any) = null;
  }
}