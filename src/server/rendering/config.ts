// src/server/rendering/config.ts

export interface EncoderTimeoutsConfig {
  startupMs: number;
  writeMs: number;
  finishMs: number;
}

export interface RenderWatchdogConfig {
  maxRenderMs: number;
  maxHeapUsedBytes: number;
  sampleIntervalMs: number;
}

export const ENCODER_TIMEOUTS: EncoderTimeoutsConfig = {
  startupMs: Number(process.env.FFMPEG_STARTUP_TIMEOUT_MS ?? 10000),
  writeMs: Number(process.env.FFMPEG_WRITE_TIMEOUT_MS ?? 30000),
  finishMs: Number(process.env.FFMPEG_FINISH_TIMEOUT_MS ?? 60000),
};

export const RENDER_WATCHDOG: RenderWatchdogConfig = {
  maxRenderMs: Number(process.env.RENDER_MAX_MS ?? 5 * 60 * 1000), // 5 minutes
  maxHeapUsedBytes: Number(process.env.RENDER_MAX_HEAP_BYTES ?? 700 * 1024 * 1024), // 700MB
  sampleIntervalMs: Number(process.env.RENDER_WATCHDOG_INTERVAL_MS ?? 1000),
};
