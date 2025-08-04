// src/animation/renderer/video-encoder.ts
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  preset: string;
  crf: number;
}

export class VideoEncoder {
  private ffmpegProcess: ChildProcess | null = null;
  private outputPath: string;
  private config: VideoConfig;

  constructor(outputPath: string, config: VideoConfig) {
    this.outputPath = outputPath;
    this.config = config;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const outputDir = path.dirname(this.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.ffmpegProcess = spawn('ffmpeg', [
        '-f', 'rawvideo',
        '-pix_fmt', 'rgb24',
        '-s', `${this.config.width}x${this.config.height}`,
        '-r', this.config.fps.toString(),
        '-i', 'pipe:0',
        '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264',
        '-preset', this.config.preset,
        '-crf', this.config.crf.toString(),
        '-y', this.outputPath
      ]);

      this.ffmpegProcess.on('error', (error) => {
        reject(new Error(`FFmpeg failed: ${error.message}`));
      });

      this.ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}`));
        } else {
          resolve();
        }
      });

      // Wait a moment for process to be ready
      setTimeout(() => resolve(), 100);
    });
  }

  async writeFrame(frameData: Buffer): Promise<void> {
    if (!this.ffmpegProcess?.stdin) {
      throw new Error('FFmpeg process not started');
    }

    return new Promise((resolve, reject) => {
      if (this.ffmpegProcess!.stdin!.write(frameData)) {
        resolve();
      } else {
        const onDrain = () => {
          this.ffmpegProcess!.stdin!.removeListener('error', onError);
          resolve();
        };
        const onError = (error: unknown) => {
          this.ffmpegProcess!.stdin!.removeListener('drain', onDrain);
          reject(error instanceof Error ? error : new Error(String(error)));
        };

        this.ffmpegProcess!.stdin!.once('drain', onDrain);
        this.ffmpegProcess!.stdin!.once('error', onError);
      }
    });
  }

  async finish(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ffmpegProcess) {
        resolve();
        return;
      }

      this.ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}`));
        } else {
          resolve();
        }
        this.ffmpegProcess = null;
      });

      this.ffmpegProcess.stdin?.end();
    });
  }

  kill(): void {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill();
      this.ffmpegProcess = null;
    }
  }
}

export function convertImageDataToRGB(
  imageData: ImageData,
  width: number,
  height: number
): Buffer {
  const pixelCount = width * height;
  const rgbPixels = new Uint8Array(pixelCount * 3);

  for (let i = 0; i < pixelCount; i++) {
    const rgbaIndex = i * 4;
    const rgbIndex = i * 3;
    rgbPixels[rgbIndex] = imageData.data[rgbaIndex]!;
    rgbPixels[rgbIndex + 1] = imageData.data[rgbaIndex + 1]!;
    rgbPixels[rgbIndex + 2] = imageData.data[rgbaIndex + 2]!;
  }

  return Buffer.from(rgbPixels);
}