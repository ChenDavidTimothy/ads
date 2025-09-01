// src/animation/renderer/video-encoder.ts
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  preset: string;
  crf: number;
  // Raw input pixel format
  inputPixelFormat: "rgb24" | "rgba" | "bgra";
}

import { ENCODER_TIMEOUTS as GLOBAL_ENCODER_TIMEOUTS } from "@/server/rendering/config";

interface EncoderTimeouts {
  startupMs: number;
  writeMs: number;
  finishMs: number;
}

export class VideoEncoder {
  private ffmpegProcess: ChildProcess | null = null;
  private outputPath: string;
  private config: VideoConfig;
  private timeouts: EncoderTimeouts;
  private stderrBuffer = "";

  constructor(
    outputPath: string,
    config: VideoConfig,
    timeouts: Partial<EncoderTimeouts> = {},
  ) {
    this.outputPath = outputPath;
    this.config = config;
    this.timeouts = {
      ...GLOBAL_ENCODER_TIMEOUTS,
      ...timeouts,
    } as EncoderTimeouts;
  }

  private async validateFFmpeg(): Promise<void> {
    const ffmpegPath =
      process.env.FFMPEG_PATH && process.env.FFMPEG_PATH.length > 0
        ? process.env.FFMPEG_PATH
        : "ffmpeg";

    return new Promise((resolve, reject) => {
      const testProcess = spawn(ffmpegPath, ["-version"], {
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      });

      let stderr = "";
      testProcess.stderr?.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      testProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `FFmpeg validation failed with code ${code}: ${stderr.slice(-500)}`,
            ),
          );
        }
      });

      testProcess.on("error", (error) => {
        reject(new Error(`FFmpeg not found or executable: ${error.message}`));
      });
    });
  }

  async start(): Promise<void> {
    // First validate FFmpeg is available
    await this.validateFFmpeg();

    return new Promise((resolve, reject) => {
      const outputDir = path.dirname(this.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const ffmpegPath =
        process.env.FFMPEG_PATH && process.env.FFMPEG_PATH.length > 0
          ? process.env.FFMPEG_PATH
          : "ffmpeg";

      const args = [
        "-f",
        "rawvideo",
        "-pix_fmt",
        this.config.inputPixelFormat,
        "-s",
        `${this.config.width}x${this.config.height}`,
        "-r",
        this.config.fps.toString(),
        "-i",
        "pipe:0",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        this.config.preset,
        "-crf",
        this.config.crf.toString(),
        "-y",
        this.outputPath,
      ];

      let settled = false;
      const onError = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(new Error(`FFmpeg failed to start: ${error.message}`));
      };

      try {
        this.ffmpegProcess = spawn(ffmpegPath, args, {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true, // Hide console window on Windows
        });
      } catch (err) {
        return reject(err instanceof Error ? err : new Error(String(err)));
      }

      const proc = this.ffmpegProcess;

      proc.on("error", onError);

      // If the process exits before we're ready, treat as startup failure
      const startupCloseHandler = (
        code: number | null,
        signal: NodeJS.Signals | null,
      ) => {
        if (settled) return;
        settled = true;
        const stderr = this.stderrBuffer.slice(-1000);
        const errorMsg = `FFmpeg exited during startup with code ${code}, signal ${signal}. Stderr: ${stderr}`;
        console.error(`FFmpeg startup failure: ${errorMsg}`);
        reject(new Error(errorMsg));
      };
      proc.once("close", startupCloseHandler);

      // Capture stderr for diagnostics
      proc.stderr?.setEncoding("utf8");
      proc.stderr?.on("data", (chunk: string) => {
        this.stderrBuffer += chunk;
      });

      // Consider process "ready" when stdin is available and not destroyed
      const startupTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.kill();
        reject(
          new Error(
            `FFmpeg startup timeout after ${this.timeouts.startupMs}ms. Stderr: ${this.stderrBuffer.slice(-1000)}`,
          ),
        );
      }, this.timeouts.startupMs);

      const markReady = () => {
        if (settled) return;
        if (proc.stdin && !proc.stdin.destroyed) {
          settled = true;
          clearTimeout(startupTimer);
          // Remove startup close handler to avoid consuming the real close event
          proc.off("close", startupCloseHandler);
          resolve();
        }
      };

      // In practice, stdin exists immediately after spawn; guard with nextTick
      process.nextTick(markReady);
    });
  }

  async writeFrame(frameData: Buffer): Promise<void> {
    if (!this.ffmpegProcess?.stdin) {
      throw new Error("FFmpeg process not started");
    }

    const stdin = this.ffmpegProcess.stdin;

    // Additional validation for Windows compatibility
    if (stdin.destroyed || stdin.writable === false) {
      throw new Error("FFmpeg stdin stream is not writable");
    }

    return new Promise((resolve, reject) => {
      let finished = false;

      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        this.kill();
        reject(
          new Error(
            `FFmpeg frame write timeout after ${this.timeouts.writeMs}ms. Stderr: ${this.stderrBuffer.slice(-1000)}`,
          ),
        );
      }, this.timeouts.writeMs);

      const cleanup = () => {
        clearTimeout(timeout);
        stdin.removeListener("drain", onDrain);
        stdin.removeListener("error", onError);
      };

      const onDrain = () => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve();
      };

      const onError = (error: unknown) => {
        if (finished) return;
        finished = true;
        cleanup();
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`FFmpeg write error: ${errorMsg}`);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const wrote = stdin.write(frameData);
      if (wrote) {
        finished = true;
        cleanup();
        resolve();
      } else {
        stdin.once("drain", onDrain);
        stdin.once("error", onError);
      }
    });
  }

  async finish(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = this.ffmpegProcess;
      if (!proc) {
        resolve();
        return;
      }

      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.kill();
        reject(
          new Error(
            `FFmpeg finish timeout after ${this.timeouts.finishMs}ms. Stderr: ${this.stderrBuffer.slice(-1000)}`,
          ),
        );
      }, this.timeouts.finishMs);

      const onClose = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.ffmpegProcess = null;
        if (code !== 0) {
          reject(
            new Error(
              `FFmpeg exited with code ${code}. Stderr: ${this.stderrBuffer.slice(-1000)}`,
            ),
          );
        } else {
          resolve();
        }
      };

      proc.once("close", onClose);
      // Signal EOF
      proc.stdin?.end();
    });
  }

  kill(): void {
    if (this.ffmpegProcess) {
      try {
        this.ffmpegProcess.stdin?.destroy();
      } catch {
        // ignore
      }
      try {
        this.ffmpegProcess.kill();
      } catch {
        // ignore
      }
      this.ffmpegProcess = null;
    }
  }
}

export function convertImageDataToRGB(
  imageData: ImageData,
  width: number,
  height: number,
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
