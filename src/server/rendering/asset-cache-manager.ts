// src/server/rendering/asset-cache-manager.ts
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import got from "got";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/utils/supabase/service";
import { logger } from "@/lib/logger";
import { BulkAssetFetcher, type AssetMetadata } from "./bulk-asset-fetcher";
import { SharedCacheJanitor, type JanitorConfig } from "./shared-cache-janitor";
import { normalizeDir, ensureDir, getDefaultCacheDirs } from "./path-utils";

// Configure got instance with caching completely disabled to avoid keyv dependencies
const httpClient = got.extend({
  cache: false,
  retry: { limit: 0 }, // Disable got's built-in retry, we handle it with p-retry
  // Explicitly disable cacheable-request to prevent keyv dependencies
  hooks: {
    beforeRequest: [
      (options) => {
        // Ensure no caching headers are set
        delete options.headers['if-none-match'];
        delete options.headers['if-modified-since'];
      }
    ]
  }
});

export interface CachedAsset {
  assetId: string;
  localPath: string;
  contentHash: string;
  size: number;
  contentType: string;
  width?: number;
  height?: number;
  verified: boolean;
}

export interface JobManifest {
  jobId: string;
  version: string;
  totalBytes: number;
  createdAt: string;
  completedAt?: string;
  assets: Record<string, CachedAsset>;
}

export interface CacheMetrics {
  assetsRequested: number;
  assetsDownloaded: number;
  bytesDownloaded: number;
  cacheHits: number;
  sharedCacheHits: number;
  retries: number;
  downloadFailures: number;
  presignFailures: number;
  prepTimeMs: number;
  hardLinkFallbacks: number;
  copyFallbacks: number;
  raceLost: number;
  urlRefreshes: number;
  integrityFailures: number;
}

export class AssetCacheManager {
  private readonly jobId: string;
  private readonly jobCacheDir: string;
  private readonly sharedCacheDir: string;
  private readonly userId: string;
  private readonly supabase: ReturnType<typeof createServiceClient>;
  private readonly bulkFetcher: BulkAssetFetcher;
  private readonly downloadLimit: ReturnType<typeof pLimit>;
  private readonly metrics: CacheMetrics;
  private readonly maxJobSizeBytes: number;
  private readonly janitor?: SharedCacheJanitor;
  private assets = new Map<string, CachedAsset>();
  private static hardLinkTestCompleted = false;

  constructor(
    jobId: string,
    userId: string,
    options: {
      downloadConcurrency?: number;
      maxJobSizeBytes?: number;
      sharedCacheDir?: string;
      jobCacheDir?: string;
      enableJanitor?: boolean;
      janitorConfig?: Partial<JanitorConfig>;
    } = {}
  ) {
    this.jobId = jobId;
    this.userId = userId;
    this.maxJobSizeBytes = options.maxJobSizeBytes || 2 * 1024 * 1024 * 1024;

    // Cache directories with platform-appropriate defaults and path normalization
    const defaults = getDefaultCacheDirs();
    this.jobCacheDir = normalizeDir(options.jobCacheDir || path.join(
      process.env.JOB_CACHE_DIR || defaults.jobCacheDir,
      jobId
    ));
    this.sharedCacheDir = normalizeDir(options.sharedCacheDir || (
      process.env.SHARED_CACHE_DIR || defaults.sharedCacheDir
    ));

    this.supabase = createServiceClient();
    this.bulkFetcher = new BulkAssetFetcher();
    this.downloadLimit = pLimit(options.downloadConcurrency || 8);

    // Initialize shared cache janitor after ensuring directories exist
    if (options.enableJanitor) {
      void this.initializeCacheDirectories().then(async () => {
        this.janitor = new SharedCacheJanitor(this.sharedCacheDir, options.janitorConfig);
        await this.janitor.start();
      });
    }

    // Initialize metrics
    this.metrics = {
      assetsRequested: 0,
      assetsDownloaded: 0,
      bytesDownloaded: 0,
      cacheHits: 0,
      sharedCacheHits: 0,
      retries: 0,
      downloadFailures: 0,
      presignFailures: 0,
      prepTimeMs: 0,
      hardLinkFallbacks: 0,
      copyFallbacks: 0,
      raceLost: 0,
      urlRefreshes: 0,
      integrityFailures: 0,
    };

    // CRITICAL FIX: Run startup hard link test once per process
    if (!AssetCacheManager.hardLinkTestCompleted) {
      AssetCacheManager.hardLinkTestCompleted = true;
      void this.initializeCacheDirectories().then(() => {
        void this.performStartupHardLinkTest();
      });
    }
  }

  /**
   * Ensures cache directories exist before starting services
   */
  private async initializeCacheDirectories(): Promise<void> {
    try {
      await ensureDir(this.sharedCacheDir);
      await ensureDir(this.jobCacheDir);
      logger.debug("Cache directories initialized", {
        sharedCacheDir: this.sharedCacheDir,
        jobCacheDir: this.jobCacheDir,
      });
    } catch (error) {
      logger.error("Failed to initialize cache directories", {
        sharedCacheDir: this.sharedCacheDir,
        jobCacheDir: this.jobCacheDir,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async prepare(assetIds: string[]): Promise<JobManifest> {
    const startTime = Date.now();

    if (assetIds.length === 0) {
      return this.createEmptyManifest();
    }

    const uniqueAssetIds = Array.from(new Set(assetIds)).filter(Boolean);
    this.metrics.assetsRequested = uniqueAssetIds.length;

    logger.info(`Preparing ${uniqueAssetIds.length} assets for job`, {
      jobId: this.jobId,
      userId: this.userId,
      totalRequested: assetIds.length,
      uniqueAssets: uniqueAssetIds.length,
    });

    try {
      // 1. Bulk fetch metadata (single DB call)
      const assetsMetadata = await this.bulkFetcher.bulkFetchAssetMetadata(uniqueAssetIds, this.userId);

      // 2. Validate job assets
      const validation = this.bulkFetcher.validateJobAssets(assetsMetadata, this.maxJobSizeBytes);
      if (!validation.valid) {
        throw new Error(`Asset validation failed: ${validation.errors.join("; ")}`);
      }

      if (validation.warnings.length > 0) {
        logger.warn("Asset validation warnings", {
          jobId: this.jobId,
          warnings: validation.warnings,
        });
      }

      // 3. Create cache directories
      await Promise.all([
        fs.mkdir(this.jobCacheDir, { recursive: true }),
        fs.mkdir(this.sharedCacheDir, { recursive: true }),
      ]);

      // 4. Download and cache assets
      await this.downloadAndCacheAssets(assetsMetadata);

      // 5. CRITICAL FIX: Explicit validation that all assets were cached
      const missingAssets = uniqueAssetIds.filter(id => !this.assets.has(id));
      if (missingAssets.length > 0) {
        throw new Error(
          `ASSETS_FAILED: Failed to prepare assets: ${missingAssets.join(", ")}. ` +
          `Requested: ${uniqueAssetIds.length}, Prepared: ${this.assets.size}`
        );
      }

      // 6. Create and persist manifest
      const manifest: JobManifest = {
        jobId: this.jobId,
        version: "1.0",
        totalBytes: validation.totalBytes,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        assets: Object.fromEntries(this.assets.entries()),
      };

      await this.persistManifest(manifest);
      this.metrics.prepTimeMs = Date.now() - startTime;
      this.logMetrics();

      return manifest;

    } catch (error) {
      this.metrics.prepTimeMs = Date.now() - startTime;
      logger.error(`Asset preparation failed for job`, {
        jobId: this.jobId,
        userId: this.userId,
        error: error instanceof Error ? error.message : String(error),
        metrics: this.metrics,
      });
      throw error;
    }
  }

  private async downloadAndCacheAssets(assetsMetadata: AssetMetadata[]): Promise<void> {
    const downloadPromises = assetsMetadata.map(asset =>
      this.downloadLimit(async () => {
        await this.downloadAndCacheAsset(asset);
      })
    );

    await Promise.all(downloadPromises);
  }

  private async downloadAndCacheAsset(asset: AssetMetadata): Promise<void> {
    const contentHash = this.getContentHash(asset);
    const extension = this.getFileExtension(asset.storagePath, asset.mimeType);
    const filename = `${contentHash}${extension}`;

    const sharedPath = path.join(this.sharedCacheDir, filename);
    const jobPath = path.join(this.jobCacheDir, filename);

    // Check shared cache first
    if (await this.validateCachedFile(sharedPath, asset.fileSize)) {
      const linkSuccess = await this.linkOrCopyFile(sharedPath, jobPath);
      this.cacheAsset(asset, jobPath, contentHash, true);
      this.metrics.cacheHits++;
      this.metrics.sharedCacheHits++;

      if (!linkSuccess) {
        this.metrics.copyFallbacks++;
      }

      logger.debug(`Shared cache hit for asset`, { assetId: asset.id, filename });
      return;
    }

    // Download required
    await this.downloadAssetWithRetry(asset, sharedPath, jobPath, contentHash);
    this.cacheAsset(asset, jobPath, contentHash, false);
    this.metrics.assetsDownloaded++;
    this.metrics.bytesDownloaded += asset.fileSize;
  }

  private async downloadAssetWithRetry(
    asset: AssetMetadata,
    sharedPath: string,
    jobPath: string,
    contentHash: string
  ): Promise<void> {
    let signedUrl: string | null = null;

    await pRetry(async () => {
      // Get or refresh signed URL
      if (!signedUrl) {
        const { data: urlData, error: urlError } = await this.supabase.storage
          .from(asset.bucketName)
          .createSignedUrl(asset.storagePath, 7200); // 2 hour TTL

        if (urlError || !urlData) {
          this.metrics.presignFailures++;
          throw new Error(`PRESIGN_FAILED: Failed to create signed URL for ${asset.id}: ${urlError?.message || 'No URL'}`);
        }

        signedUrl = urlData.signedUrl;
      }

      // CRITICAL FIX: Use unique temp name to prevent race conditions
      const tempPath = sharedPath + '.' + Math.random().toString(36).slice(2) + '.part';

      try {
        // Download with integrity verification if content hash available
        if (asset.contentHash && asset.contentHash.length >= 32) {
          await this.downloadWithHashVerification(signedUrl, tempPath, asset);
        } else {
          await this.downloadWithSizeVerification(signedUrl, tempPath, asset);
        }

        // CRITICAL FIX: Race-safe finalization
        try {
          await fs.rename(tempPath, sharedPath);
        } catch (renameError: any) {
          if (renameError.code === 'EEXIST') {
            // Another process won the race - delete our temp and continue
            await fs.unlink(tempPath).catch(() => {});
            this.metrics.raceLost++;
            logger.debug(`Race lost for asset - another process cached first`, { assetId: asset.id });
          } else {
            // Other rename errors are genuine failures
            await fs.unlink(tempPath).catch(() => {});
            throw renameError;
          }
        }

        // Link/copy to job cache
        const linkSuccess = await this.linkOrCopyFile(sharedPath, jobPath);
        if (!linkSuccess) {
          this.metrics.copyFallbacks++;
        }

        logger.info(`Downloaded asset successfully`, {
          assetId: asset.id,
          filename: path.basename(sharedPath),
          size: this.formatBytes(asset.fileSize),
          bucket: asset.bucketName,
          path: asset.storagePath,
        });

      } catch (error: any) {
        // Cleanup temp file on failure
        await fs.unlink(tempPath).catch(() => {});

        // CRITICAL FIX: Check HTTP status code, not just error message
        const is403 = error.response?.statusCode === 403 ||
                     error.statusCode === 403 ||
                     error.message?.includes('403') ||
                     error.message?.includes('Forbidden');

        if (is403) {
          logger.warn(`Signed URL expired for asset, will refresh on retry`, {
            assetId: asset.id,
            bucket: asset.bucketName,
            path: asset.storagePath,
          });
          signedUrl = null; // Force refresh on next retry
          this.metrics.urlRefreshes++;
        }

        this.metrics.downloadFailures++;
        throw error;
      }
    }, {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
      onFailedAttempt: (error) => {
        this.metrics.retries++;
        logger.warn(`Download retry for asset`, {
          assetId: asset.id,
          attempt: error.attemptNumber,
          retriesLeft: error.retriesLeft,
          error: error instanceof Error ? error.message : String(error),
          bucket: asset.bucketName,
          path: asset.storagePath,
        });
      },
    });
  }

  private async downloadWithHashVerification(url: string, tempPath: string, asset: AssetMetadata): Promise<void> {
    const { createHash } = await import('crypto');
    const { PassThrough } = await import('stream');

    const hasher = createHash('sha256');
    const passThrough = new PassThrough();

    // Tee stream to hasher while writing to disk
    passThrough.on('data', (chunk) => hasher.update(chunk));

    const gotStream = httpClient.stream(url, {
      timeout: { request: 30000 },
    });

    gotStream.pipe(passThrough);

    await pipeline(passThrough, createWriteStream(tempPath));

    // Verify size and hash
    const stat = await fs.stat(tempPath);
    if (stat.size !== asset.fileSize) {
      throw new Error(`DOWNLOAD_FAILED: Size mismatch for ${asset.id}: expected ${asset.fileSize}, got ${stat.size}`);
    }

    const computedHash = hasher.digest('hex');
    if (computedHash !== asset.contentHash) {
      this.metrics.integrityFailures++;
      throw new Error(`INTEGRITY_FAILED: Content hash mismatch for ${asset.id}: expected ${asset.contentHash}, got ${computedHash}`);
    }
  }

  private async downloadWithSizeVerification(url: string, tempPath: string, asset: AssetMetadata): Promise<void> {
    await pipeline(
      httpClient.stream(url, {
        timeout: { request: 30000 },
      }),
      createWriteStream(tempPath)
    );

    // Verify size
    const stat = await fs.stat(tempPath);
    if (stat.size !== asset.fileSize) {
      throw new Error(`DOWNLOAD_FAILED: Size mismatch for ${asset.id}: expected ${asset.fileSize}, got ${stat.size}`);
    }
  }

  private async validateCachedFile(filePath: string, expectedSize: number): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.size === expectedSize;
    } catch {
      return false;
    }
  }

  private async linkOrCopyFile(source: string, dest: string): Promise<boolean> {
    try {
      await fs.link(source, dest);
      return true; // Hard link successful
    } catch (error: any) {
      if (error.code === 'EEXIST') return true; // Already exists

      if (error.code === 'EXDEV' || error.code === 'EPERM') {
        // Cross-filesystem, fallback to copy
        try {
          await fs.copyFile(source, dest);
          this.metrics.hardLinkFallbacks++;
          return false; // Copy fallback used
        } catch (copyError) {
          throw new Error(`Both hard link and copy failed: ${error.message}, ${copyError}`);
        }
      }

      throw error;
    }
  }

  private cacheAsset(asset: AssetMetadata, localPath: string, contentHash: string, fromCache: boolean): void {
    this.assets.set(asset.id, {
      assetId: asset.id,
      localPath, // CRITICAL FIX: Absolute path only, no file:// scheme
      contentHash,
      size: asset.fileSize,
      contentType: asset.mimeType,
      width: asset.imageWidth,
      height: asset.imageHeight,
      verified: fromCache,
    });
  }

  private getContentHash(asset: AssetMetadata): string {
    if (asset.contentHash && asset.contentHash.length >= 32) {
      return asset.contentHash;
    }

    // Fallback: metadata-based hash (temporary)
    const metadataContent = `${asset.id}:${asset.storagePath}:${asset.fileSize}:${asset.createdAt}`;
    const { createHash } = require('crypto');
    return createHash('sha256').update(metadataContent).digest('hex');
  }

  private getFileExtension(storagePath: string, mimeType: string): string {
    const pathExt = path.extname(storagePath);
    if (pathExt) return pathExt;

    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
    };

    return mimeToExt[mimeType] || '.bin';
  }

  private async persistManifest(manifest: JobManifest): Promise<void> {
    const manifestPath = path.join(this.jobCacheDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  private createEmptyManifest(): JobManifest {
    return {
      jobId: this.jobId,
      version: "1.0",
      totalBytes: 0,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      assets: {},
    };
  }

  private logMetrics(): void {
    const hitRate = this.metrics.assetsRequested > 0
      ? (this.metrics.cacheHits / this.metrics.assetsRequested * 100).toFixed(1)
      : '0';

    const sharedHitRate = this.metrics.cacheHits > 0
      ? (this.metrics.sharedCacheHits / this.metrics.cacheHits * 100).toFixed(1)
      : '0';

    const copyRate = this.metrics.hardLinkFallbacks > 0
      ? (this.metrics.copyFallbacks / this.metrics.hardLinkFallbacks * 100).toFixed(1)
      : '0';

    logger.info(`Asset cache metrics for job`, {
      jobId: this.jobId,
      assetsRequested: this.metrics.assetsRequested,
      assetsDownloaded: this.metrics.assetsDownloaded,
      cacheHitRate: `${hitRate}%`,
      sharedCacheHitRate: `${sharedHitRate}%`,
      bytesDownloaded: this.formatBytes(this.metrics.bytesDownloaded),
      prepTimeMs: this.metrics.prepTimeMs,
      retries: this.metrics.retries,
      downloadFailures: this.metrics.downloadFailures,
      presignFailures: this.metrics.presignFailures,
      copyFallbacks: this.metrics.copyFallbacks,
      raceLost: this.metrics.raceLost,
      urlRefreshes: this.metrics.urlRefreshes,
      integrityFailures: this.metrics.integrityFailures,
    });

    // Critical operational warnings
    if (this.metrics.copyFallbacks > 0) {
      logger.warn(`Copy fallback rate: ${copyRate}% - consider ensuring cache directories on same filesystem`, {
        jobId: this.jobId,
        copyFallbacks: this.metrics.copyFallbacks,
        hardLinkFallbacks: this.metrics.hardLinkFallbacks,
      });
    }

    if (this.metrics.integrityFailures > 0) {
      logger.error(`Content integrity failures detected`, {
        jobId: this.jobId,
        integrityFailures: this.metrics.integrityFailures,
        assetsAffected: this.metrics.integrityFailures,
      });
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * CRITICAL FIX: Startup test for hard link capability
   */
  private async performStartupHardLinkTest(): Promise<void> {
    try {
      await fs.mkdir(this.sharedCacheDir, { recursive: true });
      await fs.mkdir(this.jobCacheDir, { recursive: true });

      const testContent = `hardlink-test-${Date.now()}`;
      const testSource = path.join(this.sharedCacheDir, '.hardlink-test');
      const testTarget = path.join(this.jobCacheDir, '.hardlink-test');

      await fs.writeFile(testSource, testContent);

      try {
        await fs.link(testSource, testTarget);

        const targetContent = await fs.readFile(testTarget, 'utf8');
        const sourceStats = await fs.stat(testSource);
        const targetStats = await fs.stat(testTarget);

        if (targetContent === testContent && sourceStats.ino === targetStats.ino) {
          logger.info("Hard link test passed - optimal cache performance enabled", {
            sharedCacheDir: this.sharedCacheDir,
            jobCacheDir: this.jobCacheDir,
          });
        } else {
          logger.warn("Hard link test inconclusive - may use copy fallbacks");
        }

        await Promise.all([
          fs.unlink(testSource).catch(() => {}),
          fs.unlink(testTarget).catch(() => {}),
        ]);

      } catch (linkError: any) {
        if (linkError.code === 'EXDEV') {
          logger.warn("Hard links not supported between cache directories - will use copy fallbacks", {
            reason: "Cross-filesystem",
            sharedCacheDir: this.sharedCacheDir,
            jobCacheDir: this.jobCacheDir,
            impact: "Doubled disk usage expected",
          });
        } else {
          logger.warn("Hard link test failed - will use copy fallbacks", {
            error: linkError.message,
            impact: "Doubled disk usage expected",
          });
        }

        await fs.unlink(testSource).catch(() => {});
      }

    } catch (error) {
      logger.warn("Failed to perform hard link startup test", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getAsset(assetId: string): CachedAsset | null {
    return this.assets.get(assetId) || null;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.janitor) {
        this.janitor.stop();
      }
      await fs.rm(this.jobCacheDir, { recursive: true, force: true });
      logger.info(`Cleaned job cache`, { jobId: this.jobId, jobCacheDir: this.jobCacheDir });
    } catch (error) {
      logger.warn(`Failed to cleanup job cache`, {
        jobId: this.jobId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }
}
