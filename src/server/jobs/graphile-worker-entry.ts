// src/server/jobs/graphile-worker-entry.ts
import { workerEnv } from "./env";

import { run, type Runner, type TaskList } from "graphile-worker";
import { createServiceClient } from "@/utils/supabase/service-worker";
import { CanvasRenderer } from "@/server/rendering/canvas-renderer";
import { SmartStorageProvider } from "@/server/storage/smart-storage-provider";
import type { AnimationScene } from "@/shared/types/scene";
import type { SceneAnimationConfig } from "@/server/rendering/renderer";
import { notifyRenderJobEvent } from "./pg-events";
import { logger } from "@/lib/logger";
import { Pool } from "pg";

interface RenderJobPayload {
  scene: AnimationScene;
  config: SceneAnimationConfig;
  userId: string;
  jobId: string;
}

let runner: Runner | null = null;

async function main() {
  const concurrency = Number(workerEnv.RENDER_CONCURRENCY);
  const connectionString = workerEnv.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const tasks: TaskList = {
    "render-video": async (payload: unknown, helpers) => {
      const { job } = helpers;
      const supabase = createServiceClient();
      const { jobId, userId, scene, config } = payload as RenderJobPayload;

      try {
        logger.info("Render job started", {
          jobId,
          gwJobId: job.id,
          userId,
          outputSubdir: config?.outputSubdir,
          outputBasename: config?.outputBasename,
        });
        await supabase
          .from("render_jobs")
          .update({
            status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("user_id", userId);

        const storageProvider = new SmartStorageProvider(userId);
        const renderer = new CanvasRenderer(storageProvider);
        const { publicUrl } = await renderer.render(scene, config);

        await supabase
          .from("render_jobs")
          .update({
            status: "completed",
            output_url: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("user_id", userId);

        await notifyRenderJobEvent({ jobId, status: "completed", publicUrl });
        logger.info("Render job completed successfully", {
          jobId,
          gwJobId: job.id,
          publicUrl,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.errorWithStack("Render job failed", error, {
          jobId,
          gwJobId: job.id,
          userId,
          outputSubdir: config?.outputSubdir,
          outputBasename: config?.outputBasename,
        });

        // Update DB status and rethrow to let Graphile handle retries
        await createServiceClient()
          .from("render_jobs")
          .update({
            status: "failed",
            error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("user_id", userId);

        throw error;
      }
    },
    "render-image": async (payload: unknown, helpers) => {
      const { job } = helpers;
      const supabase = createServiceClient();
      const { jobId, userId, scene, config } = payload as {
        jobId: string;
        userId: string;
        scene: unknown;
        config: {
          width: number;
          height: number;
          backgroundColor: string;
          format: "png" | "jpeg";
          quality?: number;
          time?: number;
          outputBasename?: string;
          outputSubdir?: string;
        };
      };

      try {
        await supabase
          .from("render_jobs")
          .update({
            status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("user_id", userId);

        const storageProvider = new SmartStorageProvider(userId);
        const { ImageRenderer } = await import(
          "@/server/rendering/image/image-renderer"
        );
        const renderer = new ImageRenderer(storageProvider);
        const { publicUrl } = await renderer.render(
          scene as AnimationScene,
          config,
        );

        await supabase
          .from("render_jobs")
          .update({
            status: "completed",
            output_url: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("user_id", userId);

        await notifyRenderJobEvent({ jobId, status: "completed", publicUrl });
        logger.info("Image render job completed successfully", {
          jobId,
          gwJobId: job.id,
          publicUrl,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.errorWithStack("Image render job failed", error, {
          jobId,
          gwJobId: job.id,
          userId,
          outputSubdir: config?.outputSubdir,
          outputBasename: config?.outputBasename,
        });
        await createServiceClient()
          .from("render_jobs")
          .update({
            status: "failed",
            error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("user_id", userId);
        throw error;
      }
    },
  };

  // Use a shared pool with TCP keepalive so LISTEN connections don't silently drop on idle
  const pgPool = new Pool({
    connectionString,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    idleTimeoutMillis: 0,
  });

  runner = await run({
    pgPool,
    concurrency,
    taskList: tasks,
    // Maintain low polling to reduce DB load; rely on NOTIFY for instant wake
    pollInterval: 30000,
  });

  logger.info("Graphile Worker started", { concurrency });

  const shutdown = async () => {
    if (!runner) return;
    try {
      logger.info("Shutting down Graphile Worker...");
      await runner.stop();
      logger.info("Graphile Worker shutdown complete");
    } catch (err) {
      logger.errorWithStack("Error during Graphile Worker shutdown", err);
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  // keep process alive
  process.stdin.resume();
}

main().catch((err) => {
  console.error("Failed to start Graphile Worker:", err);
  process.exit(1);
});
