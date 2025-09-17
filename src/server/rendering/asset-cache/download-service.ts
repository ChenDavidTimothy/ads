import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import pRetry from 'p-retry';
import { request } from 'undici';

import { logger } from '@/lib/logger';
import type { AssetMetadata } from '../bulk-asset-fetcher';
import type { createServiceClient } from '@/utils/supabase/service';
import type { LimitFunction } from 'p-limit';
import type { CacheMetrics } from './types';

const httpConfig = {
  headersTimeout: 30000,
  bodyTimeout: 30000,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getStatusCode = (value: unknown): number | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const statusCandidate = value.statusCode;
  return typeof statusCandidate === 'number' ? statusCandidate : undefined;
};

const getErrorMessage = (value: unknown): string => {
  if (!isRecord(value)) {
    return '';
  }
  const message = value.message;
  return typeof message === 'string' ? message : '';
};

interface DownloadServiceDeps {
  sharedCacheDir: string;
  jobCacheDir: string;
  supabase: ReturnType<typeof createServiceClient>;
  downloadLimit: LimitFunction;
  metrics: CacheMetrics;
  cacheAsset: (
    asset: AssetMetadata,
    jobPath: string,
    contentHash: string,
    fromCache: boolean
  ) => void;
}

export class AssetDownloadService {
  private readonly sharedCacheDir: string;
  private readonly jobCacheDir: string;
  private readonly supabase: ReturnType<typeof createServiceClient>;
  private readonly downloadLimit: LimitFunction;
  private readonly metrics: CacheMetrics;
  private readonly cacheAsset: DownloadServiceDeps['cacheAsset'];

  constructor(options: DownloadServiceDeps) {
    this.sharedCacheDir = options.sharedCacheDir;
    this.jobCacheDir = options.jobCacheDir;
    this.supabase = options.supabase;
    this.downloadLimit = options.downloadLimit;
    this.metrics = options.metrics;
    this.cacheAsset = options.cacheAsset;
  }

  async downloadAndCacheAssets(assets: AssetMetadata[]): Promise<void> {
    const downloads = assets.map((asset) =>
      this.downloadLimit(async () => {
        await this.downloadAndCacheAsset(asset);
      })
    );

    await Promise.all(downloads);
  }

  private async downloadAndCacheAsset(asset: AssetMetadata): Promise<void> {
    const contentHash = this.getContentHash(asset);
    const extension = this.getFileExtension(asset.storagePath, asset.mimeType);
    const filename = `${contentHash}${extension}`;

    const sharedPath = path.join(this.sharedCacheDir, filename);
    const jobPath = path.join(this.jobCacheDir, filename);

    if (await this.validateCachedFile(sharedPath, asset.fileSize)) {
      const linkSuccess = await this.linkOrCopyFile(sharedPath, jobPath);
      this.cacheAsset(asset, jobPath, contentHash, true);
      this.metrics.cacheHits++;
      this.metrics.sharedCacheHits++;

      if (!linkSuccess) {
        this.metrics.copyFallbacks++;
      }

      logger.debug('Shared cache hit for asset', {
        assetId: asset.id,
        filename,
      });
      return;
    }

    await this.downloadAssetWithRetry(asset, sharedPath, jobPath, contentHash);
    this.cacheAsset(asset, jobPath, contentHash, false);
    this.metrics.assetsDownloaded++;
    this.metrics.bytesDownloaded += asset.fileSize;
  }

  private async downloadAssetWithRetry(
    asset: AssetMetadata,
    sharedPath: string,
    jobPath: string,
    _contentHash: string
  ): Promise<void> {
    let signedUrl: string | null = null;

    await pRetry(
      async () => {
        if (!signedUrl) {
          const { data: urlData, error: urlError } = await this.supabase.storage
            .from(asset.bucketName)
            .createSignedUrl(asset.storagePath, 7200);

          if (urlError || !urlData) {
            this.metrics.presignFailures++;
            throw new Error(
              `PRESIGN_FAILED: Failed to create signed URL for ${asset.id}: ${urlError?.message || 'No URL'}`
            );
          }

          signedUrl = urlData.signedUrl;
        }

        const tempPath = sharedPath + '.' + Math.random().toString(36).slice(2) + '.part';

        try {
          if (asset.contentHash && asset.contentHash.length >= 32) {
            await this.downloadWithHashVerification(signedUrl, tempPath, asset);
          } else {
            await this.downloadWithSizeVerification(signedUrl, tempPath, asset);
          }

          try {
            await fs.rename(tempPath, sharedPath);
          } catch (renameError: unknown) {
            if (
              renameError &&
              typeof renameError === 'object' &&
              'code' in renameError &&
              (renameError as NodeJS.ErrnoException).code === 'EEXIST'
            ) {
              await fs.unlink(tempPath).catch(() => {
                // Ignore cleanup errors
              });
              this.metrics.raceLost++;
              logger.debug('Race lost for asset - another process cached first', {
                assetId: asset.id,
              });
            } else {
              await fs.unlink(tempPath).catch(() => {
                // Ignore cleanup errors
              });
              throw renameError;
            }
          }

          const linkSuccess = await this.linkOrCopyFile(sharedPath, jobPath);
          if (!linkSuccess) {
            this.metrics.copyFallbacks++;
          }

          logger.info('Downloaded asset successfully', {
            assetId: asset.id,
            filename: path.basename(sharedPath),
            size: this.formatBytes(asset.fileSize),
            bucket: asset.bucketName,
            path: asset.storagePath,
          });
        } catch (error: unknown) {
          await fs.unlink(tempPath).catch(() => {
            // Ignore cleanup errors
          });

          const responseStatus =
            isRecord(error) && 'response' in error ? getStatusCode(error.response) : undefined;
          const directStatus = getStatusCode(error);
          const message = getErrorMessage(error);

          const is403 =
            responseStatus === 403 ||
            directStatus === 403 ||
            message.includes('403') ||
            message.includes('Forbidden');

          if (is403) {
            logger.warn('Signed URL expired for asset, will refresh on retry', {
              assetId: asset.id,
              bucket: asset.bucketName,
              path: asset.storagePath,
            });
            signedUrl = null;
            this.metrics.urlRefreshes++;
          }

          this.metrics.downloadFailures++;
          throw error;
        }
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
        onFailedAttempt: (error) => {
          this.metrics.retries++;
          const errorMessage =
            error instanceof Error
              ? error.message
              : typeof error === 'string'
                ? error
                : 'Unknown error';
          const attemptNumber =
            error &&
            typeof error === 'object' &&
            'attemptNumber' in error &&
            typeof (error as { attemptNumber?: number }).attemptNumber === 'number'
              ? (error as { attemptNumber: number }).attemptNumber
              : 0;
          const retriesLeft =
            error &&
            typeof error === 'object' &&
            'retriesLeft' in error &&
            typeof (error as { retriesLeft?: number }).retriesLeft === 'number'
              ? (error as { retriesLeft: number }).retriesLeft
              : 0;
          logger.warn('Download retry for asset', {
            assetId: asset.id,
            attempt: attemptNumber,
            retriesLeft,
            error: errorMessage,
            bucket: asset.bucketName,
            path: asset.storagePath,
          });
        },
      }
    );
  }

  private async downloadWithHashVerification(
    url: string,
    tempPath: string,
    asset: AssetMetadata
  ): Promise<void> {
    const hasher = createHash('sha256');
    const passThrough = new PassThrough();

    passThrough.on('data', (chunk) => {
      if (Buffer.isBuffer(chunk) || typeof chunk === 'string') {
        hasher.update(chunk);
      }
    });

    const { body: responseStream } = await request(url, httpConfig);

    responseStream.pipe(passThrough);

    await pipeline(passThrough, createWriteStream(tempPath));

    const stat = await fs.stat(tempPath);
    if (stat.size !== asset.fileSize) {
      throw new Error(
        `DOWNLOAD_FAILED: Size mismatch for ${asset.id}: expected ${asset.fileSize}, got ${stat.size}`
      );
    }

    const computedHash = hasher.digest('hex');
    if (computedHash !== asset.contentHash) {
      this.metrics.integrityFailures++;
      throw new Error(
        `INTEGRITY_FAILED: Content hash mismatch for ${asset.id}: expected ${asset.contentHash}, got ${computedHash}`
      );
    }
  }

  private async downloadWithSizeVerification(
    url: string,
    tempPath: string,
    asset: AssetMetadata
  ): Promise<void> {
    const { body: responseStream } = await request(url, httpConfig);

    await pipeline(responseStream, createWriteStream(tempPath));

    const stat = await fs.stat(tempPath);
    if (stat.size !== asset.fileSize) {
      throw new Error(
        `DOWNLOAD_FAILED: Size mismatch for ${asset.id}: expected ${asset.fileSize}, got ${stat.size}`
      );
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
      return true;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'EEXIST'
      ) {
        return true;
      }

      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ((error as NodeJS.ErrnoException).code === 'EXDEV' ||
          (error as NodeJS.ErrnoException).code === 'EPERM')
      ) {
        try {
          await fs.copyFile(source, dest);
          this.metrics.hardLinkFallbacks++;
          return false;
        } catch (copyError) {
          const errorMessage =
            error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof (error as { message?: string }).message === 'string'
              ? (error as { message?: string }).message
              : 'Unknown error';
          const copyErrorMessage =
            copyError instanceof Error ? copyError.message : String(copyError);
          throw new Error(`Both hard link and copy failed: ${errorMessage}, ${copyErrorMessage}`);
        }
      }

      throw error;
    }
  }

  private getContentHash(asset: AssetMetadata): string {
    if (asset.contentHash && asset.contentHash.length >= 32) {
      return asset.contentHash;
    }

    const metadataContent = `${asset.id}:${asset.storagePath}:${asset.fileSize}:${asset.createdAt}`;
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

    return mimeToExt[mimeType] ?? '.bin';
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
}
