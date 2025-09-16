// src/server/storage/cleanup-runner.ts
import os from "os";
import path from "path";
import fs from "fs";
import { STORAGE_CONFIG } from "./config";
import type { createServiceClient } from "@/utils/supabase/service";

interface StorageCleanupRunnerDeps {
  supabase: ReturnType<typeof createServiceClient>;
  logger: Console;
  tempDir: string;
}

export class StorageCleanupRunner {
  private readonly supabase: ReturnType<typeof createServiceClient>;
  private readonly logger: Console;
  private readonly tempDir: string;

  constructor(deps: StorageCleanupRunnerDeps) {
    this.supabase = deps.supabase;
    this.logger = deps.logger;
    this.tempDir = deps.tempDir;
  }

  async performComprehensiveCleanup(): Promise<void> {
    try {
      this.logger.info("Starting comprehensive cleanup cycle");

      await this.cleanupOldTempFiles();
      await this.cleanupOldTempDirectories();
      await this.cleanupOrphanedSupabaseFiles();
      await this.cleanupOrphanedRenderJobs();

      this.logger.info("Comprehensive cleanup cycle completed");
    } catch (error) {
      this.logger.error("Comprehensive cleanup cycle failed:", error);
    }
  }

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
        this.logger.info(`dY1 Cleaned up ${cleanedCount} local temp files`);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        try {
          await fs.promises.mkdir(this.tempDir, { recursive: true });
          this.logger.warn(`Temp directory missing; recreated at ${this.tempDir}`);
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
        `dY"? Checking for old temp files and directories in ${tempDir}`,
      );

      let cleanedCount = 0;
      for (const entry of entries) {
        const itemName = entry.name;

        if (itemName.startsWith("storage-") || itemName.startsWith("mat-debug-")) {
          const itemPath = path.join(tempDir, itemName);

          try {
            const stats = await fs.promises.stat(itemPath);
            const ageMs = now - stats.mtime.getTime();

            if (ageMs > STORAGE_CONFIG.MAX_TEMP_FILE_AGE_MS) {
              if (entry.isDirectory()) {
                try {
                  await fs.promises.rm(itemPath, { recursive: true, force: true });
                  cleanedCount++;
                } catch (error) {
                  this.logger.warn(`Failed to cleanup temp directory ${itemName}:`, error);
                }
              } else {
                try {
                  await fs.promises.unlink(itemPath);
                  cleanedCount++;
                } catch (error) {
                  this.logger.warn(`Failed to cleanup temp file ${itemName}:`, error);
                }
              }
            }
          } catch (error) {
            this.logger.warn(`Failed to cleanup temp item ${itemName}:`, error);
          }
        }
      }

      if (cleanedCount > 0) {
        this.logger.info(`dY1 Cleaned up ${cleanedCount} old temp items`);
      } else {
        this.logger.info("No old temp items needed cleanup");
      }
    } catch (error) {
      this.logger.error("Failed to cleanup old temp items:", error);
    }
  }

  private async cleanupOrphanedSupabaseFiles(): Promise<void> {
    try {
      const maxAgeMs = STORAGE_CONFIG.MAX_TEMP_FILE_AGE_MS;
      const cutoffTime = new Date(Date.now() - maxAgeMs);

      const { data: orphanedJobs, error } = await this.supabase
        .from("render_jobs")
        .select("id, output_url, created_at")
        .eq("status", "completed")
        .not("output_url", "is", null)
        .lt("created_at", cutoffTime.toISOString());

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

      const { data: savedAssets, error: assetsError } = await this.supabase
        .from("user_assets")
        .select("metadata")
        .not("metadata->render_job_id", "is", null);

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

      const { data: orphanedJobs, error } = await this.supabase
        .from("render_jobs")
        .select("id")
        .eq("status", "completed")
        .lt("created_at", cutoffTime.toISOString());

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

      const { data: savedAssets, error: assetsError } = await this.supabase
        .from("user_assets")
        .select("metadata")
        .not("metadata->render_job_id", "is", null);

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

      const signIndex = pathParts.indexOf("sign");
      if (signIndex === -1 || signIndex + 2 >= pathParts.length) {
        return null;
      }

      const bucket = pathParts[signIndex + 1];
      const filePath = pathParts.slice(signIndex + 2).join("/");

      return { bucket: bucket!, path: filePath };
    } catch {
      return null;
    }
  }
}
