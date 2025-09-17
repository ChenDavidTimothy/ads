import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';

import { createServiceClient } from '@/utils/supabase/service';
import { logger } from '@/lib/logger';
import { BulkAssetFetcher, type AssetMetadata } from './bulk-asset-fetcher';
import type { CachedAsset, CacheMetrics, JobManifest } from './asset-cache/types';
import { AssetDownloadService } from './asset-cache/download-service';
import { ManifestStore } from './asset-cache/manifest-store';
import { CacheMaintenance } from './asset-cache/maintenance';
import type { SharedCacheJanitor, JanitorConfig } from './shared-cache-janitor';
import { getDefaultCacheDirs, normalizeDir } from './path-utils';

export class AssetCacheManager {
  private readonly jobId: string;
  private readonly jobCacheDir: string;
  private readonly sharedCacheDir: string;
  private readonly userId: string;
  private readonly supabase: ReturnType<typeof createServiceClient>;
  private readonly bulkFetcher: BulkAssetFetcher;
  private readonly metrics: CacheMetrics;
  private readonly maxJobSizeBytes: number;
  private readonly maintenance: CacheMaintenance;
  private readonly manifestStore: ManifestStore;
  private readonly downloadService: AssetDownloadService;
  private janitor?: SharedCacheJanitor;
  private assets = new Map<string, CachedAsset>();

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
    this.maxJobSizeBytes = options.maxJobSizeBytes ?? 2 * 1024 * 1024 * 1024;

    const defaults = getDefaultCacheDirs();
    this.jobCacheDir = normalizeDir(
      options.jobCacheDir ?? path.join(process.env.JOB_CACHE_DIR ?? defaults.jobCacheDir, jobId)
    );
    this.sharedCacheDir = normalizeDir(
      options.sharedCacheDir ?? process.env.SHARED_CACHE_DIR ?? defaults.sharedCacheDir
    );

    this.supabase = createServiceClient();
    this.bulkFetcher = new BulkAssetFetcher();

    const downloadLimit = pLimit(options.downloadConcurrency ?? 8);

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

    this.maintenance = new CacheMaintenance(this.sharedCacheDir, this.jobCacheDir);
    this.manifestStore = new ManifestStore(this.jobCacheDir);
    this.downloadService = new AssetDownloadService({
      sharedCacheDir: this.sharedCacheDir,
      jobCacheDir: this.jobCacheDir,
      supabase: this.supabase,
      downloadLimit,
      metrics: this.metrics,
      cacheAsset: (asset, jobPath, contentHash, fromCache) => {
        this.cacheAsset(asset, jobPath, contentHash, fromCache);
      },
    });

    if (options.enableJanitor) {
      void this.maintenance
        .startJanitor(options.janitorConfig)
        .then((janitor) => {
          this.janitor = janitor;
        })
        .catch(() => {
          // Errors logged inside ensureDirectories
        });
    }

    void this.maintenance.ensureHardLinkCapability();
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
      const assetsMetadata = await this.bulkFetcher.bulkFetchAssetMetadata(
        uniqueAssetIds,
        this.userId
      );

      const validation = this.bulkFetcher.validateJobAssets(assetsMetadata, this.maxJobSizeBytes);
      if (!validation.valid) {
        throw new Error(`Asset validation failed: ${validation.errors.join('; ')}`);
      }

      if (validation.warnings.length > 0) {
        logger.warn('Asset validation warnings', {
          jobId: this.jobId,
          warnings: validation.warnings,
        });
      }

      await this.maintenance.ensureDirectories({ logOnSuccess: false });

      await this.downloadService.downloadAndCacheAssets(assetsMetadata);

      const missingAssets = uniqueAssetIds.filter((id) => !this.assets.has(id));
      if (missingAssets.length > 0) {
        throw new Error(
          `ASSETS_FAILED: Failed to prepare assets: ${missingAssets.join(', ')}. ` +
            `Requested: ${uniqueAssetIds.length}, Prepared: ${this.assets.size}`
        );
      }

      const manifest: JobManifest = {
        jobId: this.jobId,
        version: '1.0',
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

  private cacheAsset(
    asset: AssetMetadata,
    localPath: string,
    contentHash: string,
    fromCache: boolean
  ): void {
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

  private createEmptyManifest(): JobManifest {
    return {
      jobId: this.jobId,
      version: '1.0',
      totalBytes: 0,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      assets: {},
    };
  }

  private async persistManifest(manifest: JobManifest): Promise<void> {
    await this.manifestStore.save(manifest);
  }

  private logMetrics(): void {
    const hitRate =
      this.metrics.assetsRequested > 0
        ? ((this.metrics.cacheHits / this.metrics.assetsRequested) * 100).toFixed(1)
        : '0';

    const sharedHitRate =
      this.metrics.cacheHits > 0
        ? ((this.metrics.sharedCacheHits / this.metrics.cacheHits) * 100).toFixed(1)
        : '0';

    const copyRate =
      this.metrics.hardLinkFallbacks > 0
        ? ((this.metrics.copyFallbacks / this.metrics.hardLinkFallbacks) * 100).toFixed(1)
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

    if (this.metrics.copyFallbacks > 0) {
      logger.warn(
        `Copy fallback rate: ${copyRate}% - consider ensuring cache directories on same filesystem`,
        {
          jobId: this.jobId,
          copyFallbacks: this.metrics.copyFallbacks,
          hardLinkFallbacks: this.metrics.hardLinkFallbacks,
        }
      );
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

  getAsset(assetId: string): CachedAsset | null {
    return this.assets.get(assetId) ?? null;
  }

  async cleanup(): Promise<void> {
    try {
      this.maintenance.stopJanitor(this.janitor);
      await fs.rm(this.jobCacheDir, { recursive: true, force: true });
      logger.info(`Cleaned job cache`, {
        jobId: this.jobId,
        jobCacheDir: this.jobCacheDir,
      });
    } catch (error) {
      logger.warn(`Failed to cleanup job cache`, {
        jobId: this.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }
}
export type { CachedAsset, JobManifest, CacheMetrics } from './asset-cache/types';
