import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { AssetCacheManager } from "@/server/rendering/asset-cache-manager";
import { renderQueue, ensureWorkerReady } from "@/server/jobs/render-queue";
import { waitForRenderJobEvent } from "@/server/jobs/pg-events";
import { createServiceClient } from "@/utils/supabase/service";
import {
  partitionByBatchKey,
  buildAnimationSceneFromPartition,
  type ScenePartition,
  type BatchedScenePartition,
} from "@/server/animation-processing/scene/scene-partitioner";
import {
  extractAssetDependenciesFromBatchedPartitions,
  getUniqueAssetIds,
} from "@/server/rendering/asset-dependency-extractor";
import {
  DEFAULT_SCENE_CONFIG,
  type SceneAnimationConfig,
} from "@/server/rendering/renderer";
import { namespacePartitionForBatch } from "@/server/animation-processing/flow-transformers";
import type { AnimationScene, SceneNodeData } from "@/shared/types";
import {
  buildContentBasename,
  sanitizeForFilename,
} from "@/shared/utils/naming";

interface AssetCacheDeferredCleanupDeps {
  assetCache: AssetCacheManager;
  cacheJobId: string;
  jobIds: string[];
}

class AssetCacheDeferredCleanup {
  private readonly assetCache: AssetCacheManager;
  private readonly cacheJobId: string;
  private readonly jobIds: string[];
  private cleanupScheduled = false;

  constructor({
    assetCache,
    cacheJobId,
    jobIds,
  }: AssetCacheDeferredCleanupDeps) {
    this.assetCache = assetCache;
    this.cacheJobId = cacheJobId;
    this.jobIds = jobIds;
  }

  scheduleCleanup(): void {
    if (this.cleanupScheduled) return;
    this.cleanupScheduled = true;

    setTimeout(() => {
      void this.performDeferredCleanup();
    }, 5000);
  }

  private async performDeferredCleanup(): Promise<void> {
    try {
      const supabase = createServiceClient();
      const { data: jobs, error } = await supabase
        .from("render_jobs")
        .select("status")
        .in("id", this.jobIds);

      if (error) {
        logger.error("Failed to check job completion status", {
          cacheJobId: this.cacheJobId,
          error: error.message,
        });
        return;
      }

      const incompleteJobs =
        jobs?.filter(
          (job) => job.status !== "completed" && job.status !== "failed",
        ) ?? [];

      if (incompleteJobs.length > 0) {
        logger.info("Deferring cache cleanup - jobs still running", {
          cacheJobId: this.cacheJobId,
          incompleteJobs: incompleteJobs.length,
          totalJobs: this.jobIds.length,
        });
        setTimeout(() => {
          void this.performDeferredCleanup();
        }, 30000);
        return;
      }

      await this.assetCache.cleanup();
      logger.info("Asset cache cleanup completed after job completion", {
        cacheJobId: this.cacheJobId,
        totalJobs: this.jobIds.length,
      });
    } catch (error) {
      logger.error("Deferred cache cleanup failed", {
        cacheJobId: this.cacheJobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

interface SceneJobSummary {
  jobId: string;
  nodeId: string;
  nodeName: string;
  nodeType: "scene";
  batchKey: string | null;
}

interface FrameJobSummary {
  jobId: string;
  nodeId: string;
  nodeName: string;
  nodeType: "frame";
  batchKey: string | null;
}

interface VideoGenerationSuccessImmediate {
  success: true;
  immediateResult: {
    jobId: string;
    contentUrl: string;
    nodeId: string;
    nodeName: string;
    nodeType: "scene";
  };
}

interface VideoGenerationSuccessBatch {
  success: true;
  jobs: SceneJobSummary[];
  totalNodes: number;
  generationType: "batch";
}

interface GenerationFailure {
  success: false;
  errors: Array<{
    type: "error";
    code: string;
    message: string;
    suggestions?: string[];
  }>;
  canRetry: true;
}

type VideoGenerationResult =
  | VideoGenerationSuccessImmediate
  | VideoGenerationSuccessBatch
  | GenerationFailure;

interface ImageGenerationSuccessImmediate {
  success: true;
  immediateResult: {
    jobId: string;
    contentUrl: string;
    nodeId: string;
    nodeName: string;
    nodeType: "frame";
  };
}

interface ImageGenerationSuccessBatch {
  success: true;
  jobs: FrameJobSummary[];
  totalNodes: number;
  generationType: "batch";
}

type ImageGenerationResult =
  | ImageGenerationSuccessImmediate
  | ImageGenerationSuccessBatch
  | GenerationFailure;

function resolveInlineWaitMs(input?: number): number {
  const envValue = process.env.RENDER_JOB_INLINE_WAIT_MS ?? "500";
  const parsed = Number(envValue);
  const base = Number.isFinite(parsed) ? parsed : 500;
  const waitMs = input ?? base;
  return Math.min(Math.max(waitMs, 0), 5000);
}

function buildVideoConfig(
  sceneNodeData: SceneNodeData,
  batchKey: string | null,
  displayName: string,
  requestConfig?: Partial<SceneAnimationConfig>,
): SceneAnimationConfig {
  return {
    ...DEFAULT_SCENE_CONFIG,
    width: sceneNodeData.width,
    height: sceneNodeData.height,
    fps: sceneNodeData.fps,
    backgroundColor: sceneNodeData.backgroundColor,
    videoPreset: sceneNodeData.videoPreset,
    videoCrf: sceneNodeData.videoCrf,
    ...requestConfig,
    outputBasename: buildContentBasename(displayName, batchKey ?? undefined),
    outputSubdir: sceneNodeData.identifier.id,
  };
}

function logAssetPreparationMetrics(
  manifest: Awaited<ReturnType<AssetCacheManager["prepare"]>>,
  assetCache: AssetCacheManager,
): void {
  logger.info("Asset cache prepared successfully", {
    jobId: manifest.jobId,
    assetsCount: Object.keys(manifest.assets).length,
    totalBytes: manifest.totalBytes,
    metrics: assetCache.getMetrics(),
  });
}

function ensureUniqueSanitizedFilenames(
  subPartitions: BatchedScenePartition[],
): void {
  const filenameMap = new Map<string, string[]>();
  for (const sp of subPartitions) {
    const base = sp.batchKey ? sanitizeForFilename(sp.batchKey) : "";
    const name = `${base || "scene"}.mp4`;
    const list = filenameMap.get(name) ?? [];
    list.push(sp.batchKey ?? "<single>");
    filenameMap.set(name, list);
  }
  const collisions = Array.from(filenameMap.entries()).filter(
    ([, keys]) => keys.length > 1,
  );
  if (collisions.length === 0) {
    return;
  }
  const detail = collisions
    .map(([fn, keys]) => `${fn} <= [${keys.join(", ")} ]`)
    .join("; ");
  throw new Error(
    `Filename collision after sanitization: ${detail}. Please choose distinct batch keys.`,
  );
}

export async function generateVideoJobsWithAssetCache(
  scenePartitions: ScenePartition[],
  userId: string,
  requestConfig?: Partial<SceneAnimationConfig>,
  inlineWaitOverrideMs?: number,
): Promise<VideoGenerationResult> {
  const allBatchedPartitions: BatchedScenePartition[] = [];
  for (const partition of scenePartitions) {
    const subPartitions = partitionByBatchKey(partition);
    allBatchedPartitions.push(...subPartitions);
  }

  const dependencies =
    extractAssetDependenciesFromBatchedPartitions(allBatchedPartitions);
  const uniqueAssetIds = getUniqueAssetIds(dependencies);

  logger.info("Asset dependencies extracted from batched partitions", {
    totalDependencies: dependencies.length,
    uniqueAssets: uniqueAssetIds.length,
    totalBatchedPartitions: allBatchedPartitions.length,
    totalScenePartitions: scenePartitions.length,
    userId,
  });

  const assetCache = new AssetCacheManager(randomUUID(), userId, {
    downloadConcurrency: parseInt(
      process.env.DOWNLOAD_CONCURRENCY_PER_JOB ?? "8",
      10,
    ),
    maxJobSizeBytes: parseInt(
      process.env.MAX_JOB_SIZE_BYTES ?? "2147483648",
      10,
    ),
    enableJanitor: process.env.ENABLE_SHARED_CACHE_JANITOR === "true",
    janitorConfig: {
      maxTotalBytes: parseInt(
        process.env.SHARED_CACHE_MAX_BYTES ?? "10737418240",
        10,
      ),
    },
  });

  let assetCacheCleanup: AssetCacheDeferredCleanup | undefined;
  const supabase = createServiceClient();

  try {
    const manifest = await assetCache.prepare(uniqueAssetIds);
    logAssetPreparationMetrics(manifest, assetCache);

    const jobIds: string[] = [];
    const jobsOut: SceneJobSummary[] = [];

    await ensureWorkerReady();

    assetCacheCleanup = new AssetCacheDeferredCleanup({
      assetCache,
      cacheJobId: manifest.jobId,
      jobIds,
    });

    for (const partition of scenePartitions) {
      const subPartitions = partitionByBatchKey(partition);

      logger.debug("Processing subPartitions", {
        sceneId: partition.sceneNode?.data?.identifier?.id,
        subPartitionsCount: subPartitions.length,
        subPartitionsValid: subPartitions.filter((sub) => sub?.sceneNode)
          .length,
        subPartitionsInvalid: subPartitions.filter((sub) => !sub?.sceneNode)
          .length,
      });

      ensureUniqueSanitizedFilenames(subPartitions);

      for (const sub of subPartitions) {
        if (!sub?.sceneNode) {
          logger.error("Invalid subPartition detected", {
            sub,
            hasSceneNode: sub?.sceneNode ? true : false,
            partitionIndex: subPartitions.indexOf(sub),
            totalPartitions: subPartitions.length,
          });
          continue;
        }

        const namespacedSubPartition = namespacePartitionForBatch(
          sub,
          sub.batchKey,
        );

        const scene: AnimationScene = await buildAnimationSceneFromPartition(
          namespacedSubPartition,
          assetCache,
        );
        const sceneData = sub.sceneNode.data as SceneNodeData;
        const displayName = sub.sceneNode.data.identifier.displayName;

        const config = buildVideoConfig(
          sceneData,
          sub.batchKey ?? null,
          displayName,
          requestConfig,
        );

        if (config.fps * scene.duration > 1800) {
          logger.warn(
            `Scene ${sub.sceneNode.data.identifier.displayName} exceeds frame limit`,
            {
              frames: config.fps * scene.duration,
              duration: scene.duration,
              fps: config.fps,
            },
          );
          continue;
        }

        const payload = { scene, config } as const;
        const { data: jobRow, error: insErr } = await supabase
          .from("render_jobs")
          .insert({ user_id: userId, status: "queued", payload })
          .select("id")
          .single();

        if (insErr || !jobRow) {
          logger.error("Failed to create job row for scene", {
            sceneId: sub.sceneNode.data.identifier.id,
            error: insErr,
          });
          continue;
        }

        const jobShort = String(jobRow.id).replace(/-/g, "").slice(0, 8);
        const uniqueBasename = `${config.outputBasename}-${jobShort}`;
        const uniqueConfig: SceneAnimationConfig = {
          ...config,
          outputBasename: uniqueBasename,
        };

        await supabase
          .from("render_jobs")
          .update({ payload: { scene, config: uniqueConfig } })
          .eq("id", jobRow.id)
          .eq("user_id", userId);

        const stableJobKey = [
          userId,
          config.outputSubdir ?? "",
          `${config.outputBasename}.mp4`,
        ]
          .filter(Boolean)
          .join(":");

        await renderQueue.enqueueOnly({
          scene,
          config: uniqueConfig,
          userId,
          jobId: jobRow.id as string,
          jobKey: stableJobKey,
        });

        jobIds.push(jobRow.id as string);
        jobsOut.push({
          jobId: jobRow.id as string,
          nodeId: sub.sceneNode.data.identifier.id,
          nodeName: sub.sceneNode.data.identifier.displayName,
          nodeType: "scene",
          batchKey: sub.batchKey ?? null,
        });
      }
    }

    if (jobIds.length === 0) {
      return {
        success: false,
        errors: [
          {
            type: "error",
            code: "ERR_NO_VALID_SCENES",
            message: "No scenes could be processed",
            suggestions: [
              "Check that scenes have valid objects",
              "Ensure scene durations are within limits",
              "Verify scene configurations",
            ],
          },
        ],
        canRetry: true,
      } satisfies GenerationFailure;
    }

    if (jobIds.length === 1) {
      const inlineWaitMs = resolveInlineWaitMs(inlineWaitOverrideMs);
      const notify = await waitForRenderJobEvent({
        jobId: jobIds[0]!,
        timeoutMs: inlineWaitMs,
      });

      if (notify && notify.status === "completed" && notify.publicUrl) {
        const firstPartition = scenePartitions[0];
        if (!firstPartition?.sceneNode?.data?.identifier) {
          logger.error("Invalid scene partition for immediate result", {
            partitionIndex: 0,
            hasPartition: !!firstPartition,
            hasSceneNode: !!firstPartition?.sceneNode,
            hasIdentifier: !!firstPartition?.sceneNode?.data?.identifier,
          });
          throw new Error(
            "Invalid scene partition structure for immediate result",
          );
        }

        return {
          success: true,
          immediateResult: {
            jobId: jobIds[0]!,
            contentUrl: notify.publicUrl,
            nodeId: firstPartition.sceneNode.data.identifier.id,
            nodeName: firstPartition.sceneNode.data.identifier.displayName,
            nodeType: "scene",
          },
        } satisfies VideoGenerationSuccessImmediate;
      }
    }

    return {
      success: true,
      jobs: jobsOut,
      totalNodes: jobsOut.length,
      generationType: "batch",
    } satisfies VideoGenerationSuccessBatch;
  } finally {
    if (assetCacheCleanup) {
      assetCacheCleanup.scheduleCleanup();
    }
  }
}

export async function generateImageJobsWithAssetCache(
  scenePartitions: ScenePartition[],
  userId: string,
  inlineWaitOverrideMs?: number,
): Promise<ImageGenerationResult> {
  const allBatchedPartitions: BatchedScenePartition[] = [];
  for (const partition of scenePartitions) {
    const subs = partitionByBatchKey(partition);
    allBatchedPartitions.push(...subs);
  }

  const dependencies =
    extractAssetDependenciesFromBatchedPartitions(allBatchedPartitions);
  const uniqueAssetIds = getUniqueAssetIds(dependencies);

  logger.info("Asset dependencies extracted from batched partitions (images)", {
    totalDependencies: dependencies.length,
    uniqueAssets: uniqueAssetIds.length,
    totalBatchedPartitions: allBatchedPartitions.length,
    totalScenePartitions: scenePartitions.length,
    userId,
  });

  const assetCache = new AssetCacheManager(randomUUID(), userId, {
    enableJanitor: process.env.ENABLE_SHARED_CACHE_JANITOR === "true",
  });

  let assetCacheCleanup: AssetCacheDeferredCleanup | undefined;
  const supabase = createServiceClient();

  try {
    const manifest = await assetCache.prepare(uniqueAssetIds);

    const jobIds: string[] = [];
    const jobsOut: FrameJobSummary[] = [];

    assetCacheCleanup = new AssetCacheDeferredCleanup({
      assetCache,
      cacheJobId: manifest.jobId,
      jobIds,
    });

    await ensureWorkerReady();
    const { imageQueue } = await import("@/server/jobs/image-queue");

    for (const partition of scenePartitions) {
      const subPartitions = partitionByBatchKey(partition);
      for (const sub of subPartitions) {
        if (!sub?.sceneNode) continue;

        const namespacedSubPartition = namespacePartitionForBatch(
          sub,
          sub.batchKey,
        );

        const scene: AnimationScene = await buildAnimationSceneFromPartition(
          namespacedSubPartition,
          assetCache,
        );

        const frameData = sub.sceneNode.data as unknown as {
          width: number;
          height: number;
          backgroundColor: string;
          format: "png" | "jpeg";
          quality: number;
        };

        const config = {
          width: Number(frameData.width),
          height: Number(frameData.height),
          backgroundColor: String(frameData.backgroundColor),
          format: frameData.format === "jpeg" ? "jpeg" : "png",
          quality: Number(frameData.quality ?? 90),
          outputBasename: buildContentBasename(
            sub.sceneNode.data.identifier.displayName,
            sub.batchKey ?? undefined,
          ),
          outputSubdir: sub.sceneNode.data.identifier.id,
        } as const;

        const payload = { scene, config } as const;
        const { data: jobRow, error: insErr } = await supabase
          .from("render_jobs")
          .insert({ user_id: userId, status: "queued", payload })
          .select("id")
          .single();
        if (insErr || !jobRow) continue;

        const jobShortImg = String(jobRow.id).replace(/-/g, "").slice(0, 8);
        const uniqueImgBasename = `${config.outputBasename}-${jobShortImg}`;
        const uniqueImgConfig = {
          ...config,
          outputBasename: uniqueImgBasename,
        } as const;

        await supabase
          .from("render_jobs")
          .update({ payload: { scene, config: uniqueImgConfig } })
          .eq("id", jobRow.id)
          .eq("user_id", userId);

        await imageQueue.enqueueOnly({
          scene,
          config: { ...uniqueImgConfig },
          userId,
          jobId: jobRow.id as string,
        });

        jobIds.push(jobRow.id as string);
        jobsOut.push({
          jobId: jobRow.id as string,
          nodeId: sub.sceneNode.data.identifier.id,
          nodeName: sub.sceneNode.data.identifier.displayName,
          nodeType: "frame",
          batchKey: sub.batchKey ?? null,
        });
      }
    }

    if (jobIds.length === 0) {
      return {
        success: false,
        errors: [
          {
            type: "error",
            code: "ERR_NO_VALID_FRAMES",
            message: "No frames could be processed",
          },
        ],
        canRetry: true,
      } satisfies GenerationFailure;
    }

    if (jobIds.length === 1) {
      const inlineWaitMs = resolveInlineWaitMs(inlineWaitOverrideMs);
      const notify = await waitForRenderJobEvent({
        jobId: jobIds[0]!,
        timeoutMs: inlineWaitMs,
      });
      if (notify && notify.status === "completed" && notify.publicUrl) {
        const firstPartition = scenePartitions[0];
        if (!firstPartition?.sceneNode?.data?.identifier) {
          logger.error("Invalid scene partition for frame immediate result", {
            partitionIndex: 0,
            hasPartition: !!firstPartition,
            hasSceneNode: !!firstPartition?.sceneNode,
            hasIdentifier: !!firstPartition?.sceneNode?.data?.identifier,
          });
          throw new Error(
            "Invalid scene partition structure for frame immediate result",
          );
        }

        return {
          success: true,
          immediateResult: {
            jobId: jobIds[0]!,
            contentUrl: notify.publicUrl,
            nodeId: firstPartition.sceneNode.data.identifier.id,
            nodeName: firstPartition.sceneNode.data.identifier.displayName,
            nodeType: "frame",
          },
        } satisfies ImageGenerationSuccessImmediate;
      }
    }

    return {
      success: true,
      jobs: jobsOut,
      totalNodes: jobsOut.length,
      generationType: "batch",
    } satisfies ImageGenerationSuccessBatch;
  } finally {
    if (assetCacheCleanup) {
      assetCacheCleanup.scheduleCleanup();
    }
  }
}
