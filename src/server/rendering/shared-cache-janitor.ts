// src/server/rendering/shared-cache-janitor.ts
import fs from "fs/promises";
import type { Stats } from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import { normalizeDir, ensureDir } from "./path-utils";

export interface JanitorConfig {
  maxTotalBytes: number;
  maxFileAgeMs: number;
  cleanupIntervalMs: number;
}

export class SharedCacheJanitor {
  private config: JanitorConfig;
  private sharedCacheDir: string;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(sharedCacheDir: string, config: Partial<JanitorConfig> = {}) {
    this.sharedCacheDir = normalizeDir(sharedCacheDir);
    this.config = {
      maxTotalBytes: config.maxTotalBytes ?? 10 * 1024 * 1024 * 1024, // 10GB
      maxFileAgeMs: config.maxFileAgeMs ?? 7 * 24 * 60 * 60 * 1000, // 7 days
      cleanupIntervalMs: config.cleanupIntervalMs ?? 60 * 60 * 1000, // 1 hour
    };
  }

  async start(): Promise<void> {
    if (this.cleanupTimer) return;

    try {
      // Ensure directory exists before starting cleanup
      await ensureDir(this.sharedCacheDir);
    } catch (error) {
      logger.error("Failed to create shared cache directory", {
        sharedCacheDir: this.sharedCacheDir,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error) =>
        logger.error("Cache janitor cleanup failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }, this.config.cleanupIntervalMs);

    // Run initial cleanup
    void this.cleanup();
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Check if directory exists, create if missing
      try {
        await fs.access(this.sharedCacheDir);
      } catch {
        try {
          await ensureDir(this.sharedCacheDir);
          logger.debug("Shared cache directory did not exist; created it", {
            dir: this.sharedCacheDir,
          });
          // Nothing to clean yet
          return;
        } catch (createError) {
          logger.error(
            "Cache janitor cleanup error - failed to create directory",
            {
              dir: this.sharedCacheDir,
              error:
                createError instanceof Error
                  ? createError.message
                  : String(createError),
            },
          );
          return;
        }
      }

      const files = await fs.readdir(this.sharedCacheDir);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.sharedCacheDir, file);
          try {
            const stat = await fs.stat(filePath);
            return { file, filePath, stat };
          } catch {
            return null;
          }
        }),
      );

      const validFiles = fileStats.filter(Boolean) as Array<{
        file: string;
        filePath: string;
        stat: Stats;
      }>;

      const totalBytes = validFiles.reduce((sum, f) => sum + f.stat.size, 0);

      if (totalBytes <= this.config.maxTotalBytes) {
        logger.debug("Shared cache within size limit", {
          totalBytes: this.formatBytes(totalBytes),
          fileCount: validFiles.length,
        });
        return;
      }

      // Sort by mtime (oldest first) and remove until under limit
      validFiles.sort(
        (a, b) => a.stat.mtime.getTime() - b.stat.mtime.getTime(),
      );

      let bytesToRemove = totalBytes - this.config.maxTotalBytes;
      let removedCount = 0;
      let removedBytes = 0;

      for (const { filePath, stat } of validFiles) {
        if (bytesToRemove <= 0) break;

        try {
          await fs.unlink(filePath);
          bytesToRemove -= stat.size;
          removedCount++;
          removedBytes += stat.size;
        } catch (error) {
          logger.warn(`Failed to remove cache file`, {
            filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (removedCount > 0) {
        logger.info("Cache janitor cleanup completed", {
          removedFiles: removedCount,
          removedBytes: this.formatBytes(removedBytes),
          remainingFiles: validFiles.length - removedCount,
        });
      }
    } catch (error) {
      logger.error("Cache janitor cleanup error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
