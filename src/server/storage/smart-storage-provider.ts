// src/server/storage/smart-storage-provider.ts
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type {
  StoragePreparedTarget,
  StorageProvider,
  FinalizeOptions,
} from "./provider";
import { createServiceClient } from "@/utils/supabase/service";
import { StorageHealthMonitor } from "./health-monitor";
import { StorageUploadService } from "./upload-service";
import { StorageCleanupRunner } from "./cleanup-runner";
import { sanitizeForFilename } from "@/shared/utils/naming";

export class SmartStorageProvider implements StorageProvider {
  private readonly userId: string | undefined;
  private readonly imagesBucket: string;
  private readonly videosBucket: string;
  private readonly supabase: ReturnType<typeof createServiceClient>;
  private readonly tempDir: string;
  private readonly logger: Console;
  private readonly healthMonitor: StorageHealthMonitor;
  private readonly uploadService: StorageUploadService;
  private readonly cleanupRunner: StorageCleanupRunner;

  constructor(userId?: string) {
    this.userId = userId;
    this.logger = console;

    this.validateEnvironment();

    this.imagesBucket = process.env.SUPABASE_IMAGES_BUCKET!;
    this.videosBucket = process.env.SUPABASE_VIDEOS_BUCKET!;

    this.supabase = createServiceClient();

    this.tempDir = path.join(
      os.tmpdir(),
      `storage-${process.pid}-${Date.now()}`,
    );

    this.healthMonitor = new StorageHealthMonitor();

    this.uploadService = new StorageUploadService({
      supabase: this.supabase,
      healthMonitor: this.healthMonitor,
      logger: this.logger,
      buckets: {
        images: this.imagesBucket,
        videos: this.videosBucket,
      },
    });

    this.cleanupRunner = new StorageCleanupRunner({
      supabase: this.supabase,
      logger: this.logger,
      tempDir: this.tempDir,
    });

    void this.initialize();
  }

  private validateEnvironment(): void {
    const requiredVars = [
      "SUPABASE_IMAGES_BUCKET",
      "SUPABASE_VIDEOS_BUCKET",
      "SUPABASE_SERVICE_ROLE_KEY",
    ];

    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}. ` +
          "Please check your .env.local configuration.",
      );
    }
  }

  private async initialize(): Promise<void> {
    try {
      await fs.promises.mkdir(this.tempDir, { recursive: true });

      await this.validateBuckets();

      this.logger.info(
        `SmartStorageProvider initialized successfully. Temp dir: ${this.tempDir}`,
      );
    } catch (error) {
      this.logger.error("Failed to initialize SmartStorageProvider:", error);
      throw error;
    }
  }

  private async validateBuckets(): Promise<void> {
    try {
      const [imagesResult, videosResult] = await Promise.allSettled([
        this.supabase.storage.from(this.imagesBucket).list("", { limit: 1 }),
        this.supabase.storage.from(this.videosBucket).list("", { limit: 1 }),
      ]);

      if (imagesResult.status === "rejected") {
        throw new Error(
          `Images bucket '${this.imagesBucket}' is not accessible: ${imagesResult.reason}`,
        );
      }

      if (videosResult.status === "rejected") {
        throw new Error(
          `Videos bucket '${this.videosBucket}' is not accessible: ${videosResult.reason}`,
        );
      }

      this.logger.info(
        `Buckets validated: ${this.imagesBucket}, ${this.videosBucket}`,
      );
    } catch (error) {
      this.logger.error("Bucket validation failed:", error);
      throw new Error(
        `Storage bucket validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async prepareTarget(
    extension: string,
    opts?: {
      userId?: string;
      basename?: string;
      subdir?: string;
      allowUpsert?: boolean;
    },
  ): Promise<StoragePreparedTarget> {
    try {
      const uid = opts?.userId ?? this.userId ?? "anonymous";
      const unique = `${Date.now()}_${randomUUID()}`;
      const safeBase = sanitizeBasename(opts?.basename);
      const filename = `${safeBase ?? `scene_${unique}`}.${extension}`;
      const subdir = sanitizeSubdir(opts?.subdir);
      const remoteKey = path.posix.join(
        uid,
        ...(subdir ? [subdir] : []),
        filename,
      );

      const filePath = path.join(this.tempDir, filename);

      this.logger.debug(`Prepared target: ${remoteKey} -> ${filePath}`);
      return { filePath, remoteKey, allowUpsert: opts?.allowUpsert ?? false };
    } catch (error) {
      this.logger.error("Failed to prepare target:", error);
      throw new Error(
        `Failed to prepare storage target: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async finalize(
    prepared: StoragePreparedTarget,
    opts?: FinalizeOptions,
  ): Promise<{ publicUrl: string }> {
    return this.uploadService.finalize(prepared, opts);
  }

  public async performComprehensiveCleanup(): Promise<void> {
    await this.cleanupRunner.performComprehensiveCleanup();
  }

  async cleanup(): Promise<void> {
    try {
      await fs.promises.rm(this.tempDir, { recursive: true, force: true });
      this.logger.info("SmartStorageProvider cleanup completed");
    } catch (error) {
      this.logger.error("Cleanup failed:", error);
    }
  }

  async getHealthStatus() {
    return await this.healthMonitor.checkHealth();
  }

  getMetrics() {
    return this.healthMonitor.getMetrics();
  }
}

function sanitizeBasename(input?: string): string | undefined {
  if (!input) return undefined;
  const replaced = sanitizeForFilename(input);
  return replaced.length > 0 ? replaced : undefined;
}

function sanitizeSubdir(input?: string): string | undefined {
  if (!input) return undefined;
  const parts = input
    .split("/")
    .map((p) => sanitizeBasename(p) ?? "")
    .filter(Boolean);
  return parts.length > 0 ? parts.join("/") : undefined;
}
