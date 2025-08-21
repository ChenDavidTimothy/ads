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
import { STORAGE_CONFIG } from "./config";
import { StorageHealthMonitor } from "./health-monitor";
import { Readable } from "stream";
import type {
  SupportedExtension,
  SupportedImageExtension,
  SupportedVideoExtension,
} from "./config";

export class SmartStorageProvider implements StorageProvider {
  private readonly userId: string | undefined;
  private readonly imagesBucket: string;
  private readonly videosBucket: string;
  private readonly supabase: ReturnType<typeof createServiceClient>;
  private readonly tempDir: string;
  private readonly logger: Console;
  private readonly healthMonitor: StorageHealthMonitor;

  constructor(userId?: string) {
    this.userId = userId;
    this.logger = console;

    // Validate environment variables
    this.validateEnvironment();

    this.imagesBucket = process.env.SUPABASE_IMAGES_BUCKET!;
    this.videosBucket = process.env.SUPABASE_VIDEOS_BUCKET!;

    // Initialize Supabase client
    this.supabase = createServiceClient();

    // Create unique temporary directory
    this.tempDir = path.join(
      os.tmpdir(),
      `storage-${process.pid}-${Date.now()}`,
    );

    // Initialize health monitor
    this.healthMonitor = new StorageHealthMonitor();

    // Initialize and start cleanup - use void to explicitly ignore the promise
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
      // Create temp directory
      await fs.promises.mkdir(this.tempDir, { recursive: true });

      // Verify buckets exist
      await this.validateBuckets();

      // NOTE: Cleanup is now handled by the centralized CleanupService
      // No more duplicate cleanup intervals

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
      // Check if buckets exist by attempting to list them
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

  private getBucketForExtension(extension: string): {
    bucket: string;
    config: { maxSizeBytes: number; mimeTypes: Record<string, string> };
  } {
    const ext = extension.toLowerCase() as SupportedExtension;

    if (
      STORAGE_CONFIG.SUPPORTED_EXTENSIONS.images.includes(
        ext as SupportedImageExtension,
      )
    ) {
      return {
        bucket: this.imagesBucket,
        config: {
          maxSizeBytes: STORAGE_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024,
          mimeTypes: STORAGE_CONFIG.MIME_TYPES,
        },
      };
    } else if (
      STORAGE_CONFIG.SUPPORTED_EXTENSIONS.videos.includes(
        ext as SupportedVideoExtension,
      )
    ) {
      return {
        bucket: this.videosBucket,
        config: {
          maxSizeBytes: STORAGE_CONFIG.MAX_VIDEO_SIZE_MB * 1024 * 1024,
          mimeTypes: STORAGE_CONFIG.MIME_TYPES,
        },
      };
    } else {
      // Default to images bucket for unknown types
      this.logger.warn(
        `Unknown file extension '${extension}', defaulting to images bucket`,
      );
      return {
        bucket: this.imagesBucket,
        config: {
          maxSizeBytes: STORAGE_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024,
          mimeTypes: STORAGE_CONFIG.MIME_TYPES,
        },
      };
    }
  }

  private validateFileSize(
    fileSizeBytes: number,
    config: { maxSizeBytes: number },
  ): void {
    if (fileSizeBytes > config.maxSizeBytes) {
      throw new Error(
        `File size ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${(config.maxSizeBytes / 1024 / 1024).toFixed(2)}MB`,
      );
    }
  }

  async prepareTarget(
    extension: string,
    opts?: { userId?: string },
  ): Promise<StoragePreparedTarget> {
    try {
      const uid = opts?.userId ?? this.userId ?? "anonymous";
      const unique = `${Date.now()}_${randomUUID()}`;
      const filename = `scene_${unique}.${extension}`;
      const remoteKey = path.posix.join(uid, filename);

      // Create unique temporary file path
      const filePath = path.join(this.tempDir, filename);

      this.logger.debug(`Prepared target: ${remoteKey} -> ${filePath}`);
      return { filePath, remoteKey };
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
    let publicUrl: string | null = null;
    const startTime = Date.now();

    try {
      // Record upload start
      this.healthMonitor.recordUploadStart();

      // Stat file (avoid reading into memory)
      const stat = await fs.promises.stat(prepared.filePath);
      const fileSize = stat.size;

      // Determine bucket and validate file
      const extension = path.extname(prepared.remoteKey).slice(1);
      const { bucket, config } = this.getBucketForExtension(extension);

      // Validate file size
      this.validateFileSize(fileSize, config);

      // Get content type
      const contentType =
        opts?.contentType ??
        config.mimeTypes[extension] ??
        "application/octet-stream";

      // Upload with retry logic (using stream created per attempt)
      await this.uploadStreamWithRetry(
        bucket,
        prepared.remoteKey,
        prepared.filePath,
        contentType,
      );

      // Create signed URL with retry logic
      publicUrl = await this.createSignedUrlWithRetry(
        bucket,
        prepared.remoteKey,
      );

      // Record successful upload
      const uploadTime = Date.now() - startTime;
      this.healthMonitor.recordUploadSuccess(uploadTime);

      this.logger.info(
        `File uploaded successfully: ${prepared.remoteKey} -> ${bucket} (${(fileSize / 1024 / 1024).toFixed(2)}MB) in ${uploadTime}ms`,
      );

      return { publicUrl };
    } catch (error) {
      // Record failed upload
      this.healthMonitor.recordUploadFailure();

      this.logger.error("Failed to finalize upload:", error);
      throw new Error(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      // Always attempt to cleanup the temp file
      await this.cleanupTempFile(prepared.filePath);
    }
  }

  private async uploadWithRetry(
    bucket: string,
    remoteKey: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= STORAGE_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const { error } = await this.supabase.storage
          .from(bucket)
          .upload(remoteKey, fileBuffer, {
            upsert: false,
            contentType,
          });

        if (error) {
          throw error;
        }

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === STORAGE_CONFIG.MAX_RETRIES) {
          break; // Final attempt failed
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          STORAGE_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          STORAGE_CONFIG.MAX_RETRY_DELAY_MS,
        );

        this.logger.warn(
          `Upload attempt ${attempt} failed, retrying in ${delay}ms:`,
          lastError.message,
        );
        await this.sleep(delay);
      }
    }

    throw new Error(
      `Upload failed after ${STORAGE_CONFIG.MAX_RETRIES} attempts. Last error: ${lastError?.message}`,
    );
  }

  private async uploadStreamWithRetry(
    bucket: string,
    remoteKey: string,
    filePath: string,
    contentType: string,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= STORAGE_CONFIG.MAX_RETRIES; attempt++) {
      try {
        // Create a new stream per attempt
        const nodeStream = fs.createReadStream(filePath);

        // Type-safe stream conversion
        let webStream: ReadableStream<Uint8Array>;
        if (typeof Readable.toWeb === "function") {
          webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
        } else {
          // Fallback for older Node.js versions
          webStream = nodeStream as unknown as ReadableStream<Uint8Array>;
        }

        // Note: @supabase/supabase-js v2 accepts ReadableStream|Blob|ArrayBuffer|File
        const { error } = await this.supabase.storage
          .from(bucket)
          .upload(remoteKey, webStream, {
            upsert: false,
            contentType,
          });

        if (error) throw error;
        return; // success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === STORAGE_CONFIG.MAX_RETRIES) break;

        const delay = Math.min(
          STORAGE_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          STORAGE_CONFIG.MAX_RETRY_DELAY_MS,
        );
        this.logger.warn(
          `Stream upload attempt ${attempt} failed, retrying in ${delay}ms:`,
          lastError.message,
        );
        await this.sleep(delay);
      }
    }

    throw new Error(
      `Stream upload failed after ${STORAGE_CONFIG.MAX_RETRIES} attempts. Last error: ${lastError?.message}`,
    );
  }

  private async createSignedUrlWithRetry(
    bucket: string,
    remoteKey: string,
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= STORAGE_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const { data: signed, error } = await this.supabase.storage
          .from(bucket)
          .createSignedUrl(remoteKey, STORAGE_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

        if (error || !signed) {
          throw error ?? new Error("Failed to create signed URL");
        }

        return signed.signedUrl;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === STORAGE_CONFIG.MAX_RETRIES) {
          break;
        }

        const delay = Math.min(
          STORAGE_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          STORAGE_CONFIG.MAX_RETRY_DELAY_MS,
        );

        this.logger.warn(
          `Signed URL creation attempt ${attempt} failed, retrying in ${delay}ms:`,
          lastError.message,
        );
        await this.sleep(delay);
      }
    }

    throw new Error(
      `Signed URL creation failed after ${STORAGE_CONFIG.MAX_RETRIES} attempts. Last error: ${lastError?.message}`,
    );
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      // Log but don't throw - cleanup failures shouldn't break the main flow
      this.logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  // REMOVED: startCleanupInterval method - cleanup is now handled by CleanupService

  private async cleanupOldTempFiles(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.tempDir);
      const now = Date.now();

      let cleanedCount = 0;
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.promises.stat(filePath);

        if (now - stats.mtime.getTime() > STORAGE_CONFIG.MAX_TEMP_FILE_AGE_MS) {
          try {
            await fs.promises.unlink(filePath);
            cleanedCount++;
          } catch (error) {
            this.logger.warn(`Failed to cleanup old temp file ${file}:`, error);
          }
        }
      }

      if (cleanedCount > 0) {
        this.logger.info(`🧹 Cleaned up ${cleanedCount} local temp files`);
      }
    } catch (error) {
      // If the temp directory was removed externally (e.g., OS cleanup), recreate it silently
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        try {
          await fs.promises.mkdir(this.tempDir, { recursive: true });
          this.logger.warn(
            `Temp directory missing; recreated at ${this.tempDir}`,
          );
          return;
        } catch (mkdirErr) {
          this.logger.error("Failed to recreate temp directory:", mkdirErr);
          return;
        }
      }
      this.logger.error("Failed to read temp directory for cleanup:", error);
    }
  }

  private async cleanupOldTempDirectories(): Promise<void> {
    try {
      const tempDir = os.tmpdir();
      const entries = await fs.promises.readdir(tempDir, {
        withFileTypes: true,
      });
      const now = Date.now();

      this.logger.info(
        `🔍 Checking for old temp files and directories in ${tempDir}`,
      );

      let cleanedCount = 0;
      for (const entry of entries) {
        const itemName = entry.name;

        // Look for our storage directories and mat-debug items (files or directories)
        if (
          itemName.startsWith("storage-") ||
          itemName.startsWith("mat-debug-")
        ) {
          const itemPath = path.join(tempDir, itemName);

          try {
            const stats = await fs.promises.stat(itemPath);
            const ageMs = now - stats.mtime.getTime();

            // Clean up items older than 3 minutes
            if (ageMs > STORAGE_CONFIG.MAX_TEMP_FILE_AGE_MS) {
              if (entry.isDirectory()) {
                // Handle directories
                const dirContents = await fs.promises.readdir(itemPath);
                let shouldDelete = true;

                // If directory has contents, check if they're all old
                if (dirContents.length > 0) {
                  for (const subItem of dirContents) {
                    const subItemPath = path.join(itemPath, subItem);
                    const subItemStats = await fs.promises.stat(subItemPath);
                    const subItemAgeMs = now - subItemStats.mtime.getTime();

                    if (subItemAgeMs <= STORAGE_CONFIG.MAX_TEMP_FILE_AGE_MS) {
                      shouldDelete = false;
                      break;
                    }
                  }
                }

                if (shouldDelete) {
                  try {
                    await fs.promises.rm(itemPath, {
                      recursive: true,
                      force: true,
                    });
                    this.logger.info(
                      `🧹 Cleaned up old temp directory: ${itemName}`,
                    );
                    cleanedCount++;
                  } catch (deleteError) {
                    // Handle Windows directory locking gracefully
                    const errorCode = (deleteError as NodeJS.ErrnoException)
                      ?.code;
                    if (errorCode === "EBUSY" || errorCode === "EACCES") {
                      this.logger.info(
                        `⏳ Directory ${itemName} is currently in use - will retry later`,
                      );
                    } else {
                      this.logger.warn(
                        `Failed to cleanup temp directory ${itemName}:`,
                        deleteError,
                      );
                    }
                  }
                }
              } else {
                // Handle files (like mat-debug-*.txt)
                try {
                  await fs.promises.unlink(itemPath);
                  this.logger.info(`🧹 Cleaned up old temp file: ${itemName}`);
                  cleanedCount++;
                } catch (deleteError) {
                  // Handle Windows file locking gracefully
                  const errorCode = (deleteError as NodeJS.ErrnoException)
                    ?.code;
                  if (errorCode === "EBUSY" || errorCode === "EACCES") {
                    this.logger.info(
                      `⏳ File ${itemName} is currently in use - will retry later`,
                    );
                  } else {
                    this.logger.warn(
                      `Failed to cleanup temp file ${itemName}:`,
                      deleteError,
                    );
                  }
                }
              }
            }
          } catch (error) {
            this.logger.warn(`Failed to cleanup temp item ${itemName}:`, error);
          }
        }
      }

      if (cleanedCount === 0) {
        this.logger.info("No old temp items needed cleanup");
      } else {
        this.logger.info(`🧹 Cleaned up ${cleanedCount} old temp items`);
      }
    } catch (error) {
      this.logger.error("Failed to cleanup old temp items:", error);
    }
  }

  public async performComprehensiveCleanup(): Promise<void> {
    try {
      this.logger.info("Starting comprehensive cleanup cycle");

      // 1. Clean local temp files (existing functionality)
      await this.cleanupOldTempFiles();

      // 2. Clean old temp directories (storage-* and mat-debug-*)
      await this.cleanupOldTempDirectories();

      // 3. Clean orphaned Supabase storage files
      await this.cleanupOrphanedSupabaseFiles();

      // 4. Clean orphaned render job records
      await this.cleanupOrphanedRenderJobs();

      this.logger.info("Comprehensive cleanup cycle completed");
    } catch (error) {
      this.logger.error("Comprehensive cleanup cycle failed:", error);
      // Don't throw - we want the interval to continue running
    }
  }

  private async cleanupOrphanedSupabaseFiles(): Promise<void> {
    try {
      const maxAgeMs = STORAGE_CONFIG.MAX_TEMP_FILE_AGE_MS;
      const cutoffTime = new Date(Date.now() - maxAgeMs);

      // Get orphaned render jobs (completed but not saved to assets)
      const { data: orphanedJobs, error } = await this.supabase
        .from("render_jobs")
        .select("id, output_url, created_at")
        .eq("status", "completed")
        .not("output_url", "is", null)
        .lt("created_at", cutoffTime.toISOString());

      // Type assertion for Supabase response
      const typedOrphanedJobs = orphanedJobs as Array<{
        id: string;
        output_url: string;
        created_at: string;
      }> | null;

      if (error) {
        this.logger.error(
          "Failed to fetch orphaned jobs for file cleanup:",
          error,
        );
        return;
      }

      if (!typedOrphanedJobs || typedOrphanedJobs.length === 0) {
        return;
      }

      // Filter out jobs that have been saved to assets
      const { data: savedAssets, error: assetsError } = await this.supabase
        .from("user_assets")
        .select("metadata")
        .not("metadata->render_job_id", "is", null);

      // Type assertion for Supabase response
      const typedSavedAssets = savedAssets as Array<{
        metadata: { render_job_id?: string };
      }> | null;

      if (assetsError) {
        this.logger.error(
          "Failed to fetch saved assets for cleanup:",
          assetsError,
        );
        return;
      }

      const savedJobIds = new Set(
        (typedSavedAssets ?? [])
          .map((asset) => asset.metadata?.render_job_id)
          .filter((jobId): jobId is string => typeof jobId === "string"),
      );

      const filesToDelete = typedOrphanedJobs.filter(
        (job): job is typeof job & { id: string; output_url: string } =>
          typeof job.id === "string" &&
          typeof job.output_url === "string" &&
          !savedJobIds.has(job.id),
      );

      if (filesToDelete.length === 0) {
        return;
      }

      this.logger.info(
        `Cleaning up ${filesToDelete.length} orphaned Supabase files`,
      );

      // Delete files from Supabase storage
      let deletedCount = 0;
      for (const job of filesToDelete) {
        try {
          const fileInfo = this.parseStorageUrl(job.output_url);
          if (fileInfo) {
            const { error: deleteError } = await this.supabase.storage
              .from(fileInfo.bucket)
              .remove([fileInfo.path]);

            if (!deleteError) {
              deletedCount++;
              this.logger.info(
                `Deleted orphaned file: ${fileInfo.bucket}/${fileInfo.path}`,
              );
            } else {
              this.logger.warn(
                `Failed to delete file ${fileInfo.path}:`,
                deleteError.message,
              );
            }
          }
        } catch (error) {
          this.logger.warn(
            `Error processing file deletion for job ${job.id}:`,
            error,
          );
        }
      }

      if (deletedCount > 0) {
        this.logger.info(
          `Successfully deleted ${deletedCount} orphaned Supabase files`,
        );
      }
    } catch (error) {
      this.logger.error("Failed to cleanup orphaned Supabase files:", error);
    }
  }

  private async cleanupOrphanedRenderJobs(): Promise<void> {
    try {
      const maxAgeMs = STORAGE_CONFIG.MAX_TEMP_FILE_AGE_MS;
      const cutoffTime = new Date(Date.now() - maxAgeMs);

      // Get orphaned render job IDs (completed but not saved to assets, older than 3 minutes)
      const { data: orphanedJobs, error } = await this.supabase
        .from("render_jobs")
        .select("id")
        .eq("status", "completed")
        .lt("created_at", cutoffTime.toISOString());

      // Type assertion for Supabase response
      const typedOrphanedJobs = orphanedJobs as Array<{ id: string }> | null;

      if (error) {
        this.logger.error(
          "Failed to fetch orphaned jobs for record cleanup:",
          error,
        );
        return;
      }

      if (!typedOrphanedJobs || typedOrphanedJobs.length === 0) {
        return;
      }

      // Filter out jobs that have been saved to assets
      const { data: savedAssets, error: assetsError } = await this.supabase
        .from("user_assets")
        .select("metadata")
        .not("metadata->render_job_id", "is", null);

      // Type assertion for Supabase response
      const typedSavedAssets = savedAssets as Array<{
        metadata: { render_job_id?: string };
      }> | null;

      if (assetsError) {
        this.logger.error(
          "Failed to fetch saved assets for record cleanup:",
          assetsError,
        );
        return;
      }

      const savedJobIds = new Set(
        (typedSavedAssets ?? [])
          .map((asset) => asset.metadata?.render_job_id)
          .filter((jobId): jobId is string => typeof jobId === "string"),
      );

      const jobsToDelete = typedOrphanedJobs.filter(
        (job) => !savedJobIds.has(job.id),
      );

      if (jobsToDelete.length === 0) {
        return;
      }

      this.logger.info(
        `Cleaning up ${jobsToDelete.length} orphaned render job records`,
      );

      // Delete orphaned render job records
      const jobIds = jobsToDelete
        .map((job) => job.id)
        .filter((id): id is string => typeof id === "string");
      const { error: deleteError } = await this.supabase
        .from("render_jobs")
        .delete()
        .in("id", jobIds);

      if (deleteError) {
        this.logger.error(
          "Failed to delete orphaned render job records:",
          deleteError,
        );
        return;
      }

      this.logger.info(
        `Successfully deleted ${jobIds.length} orphaned render job records`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to cleanup orphaned render job records:",
        error,
      );
    }
  }

  private parseStorageUrl(
    url: string,
  ): { bucket: string; path: string } | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");

      // Supabase storage URLs: /storage/v1/object/sign/{bucket}/{path...}
      const signIndex = pathParts.indexOf("sign");
      if (signIndex === -1 || signIndex + 2 >= pathParts.length) {
        return null;
      }

      const bucket = pathParts[signIndex + 1];
      const path = pathParts.slice(signIndex + 2).join("/");

      return { bucket: bucket!, path };
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Cleanup method for graceful shutdown
  async cleanup(): Promise<void> {
    try {
      // Cleanup is now handled by CleanupService
      // Remove temp directory and all contents
      await fs.promises.rm(this.tempDir, { recursive: true, force: true });
      this.logger.info("SmartStorageProvider cleanup completed");
    } catch (error) {
      this.logger.error("Cleanup failed:", error);
    }
  }

  // Get health status
  async getHealthStatus() {
    return await this.healthMonitor.checkHealth();
  }

  // Get metrics
  getMetrics() {
    return this.healthMonitor.getMetrics();
  }
}
