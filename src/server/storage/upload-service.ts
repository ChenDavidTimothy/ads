// src/server/storage/upload-service.ts
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import type { StoragePreparedTarget, FinalizeOptions } from './provider';
import { STORAGE_CONFIG, type SupportedExtension } from './config';
import type { StorageHealthMonitor } from './health-monitor';
import type { createServiceClient } from '@/utils/supabase/service';

interface StorageUploadServiceDeps {
  supabase: ReturnType<typeof createServiceClient>;
  healthMonitor: StorageHealthMonitor;
  logger: Console;
  buckets: {
    images: string;
    videos: string;
  };
}

export class StorageUploadService {
  private readonly supabase: ReturnType<typeof createServiceClient>;
  private readonly healthMonitor: StorageHealthMonitor;
  private readonly logger: Console;
  private readonly imagesBucket: string;
  private readonly videosBucket: string;

  constructor(deps: StorageUploadServiceDeps) {
    this.supabase = deps.supabase;
    this.healthMonitor = deps.healthMonitor;
    this.logger = deps.logger;
    this.imagesBucket = deps.buckets.images;
    this.videosBucket = deps.buckets.videos;
  }

  async finalize(
    prepared: StoragePreparedTarget,
    opts?: FinalizeOptions
  ): Promise<{ publicUrl: string }> {
    let publicUrl: string | null = null;
    const startTime = Date.now();

    try {
      this.healthMonitor.recordUploadStart();

      const stat = await fs.promises.stat(prepared.filePath);
      const fileSize = stat.size;

      const extension = path.extname(prepared.remoteKey).slice(1);
      const { bucket, config } = this.getBucketForExtension(extension);

      this.validateFileSize(fileSize, config);

      const contentType =
        opts?.contentType ?? config.mimeTypes[extension] ?? 'application/octet-stream';

      await this.uploadStreamWithRetry(
        bucket,
        prepared.remoteKey,
        prepared.filePath,
        contentType,
        prepared.allowUpsert ?? false
      );

      publicUrl = await this.createSignedUrlWithRetry(bucket, prepared.remoteKey);

      const uploadTime = Date.now() - startTime;
      this.healthMonitor.recordUploadSuccess(uploadTime);

      this.logger.info(
        `File uploaded successfully: ${prepared.remoteKey} -> ${bucket} (${(fileSize / 1024 / 1024).toFixed(2)}MB) in ${uploadTime}ms`
      );

      return { publicUrl };
    } catch (error) {
      this.healthMonitor.recordUploadFailure();

      this.logger.error('Failed to finalize upload:', error);
      const errMsg = error instanceof Error ? error.message : String(error);

      if (/resource already exists/i.test(errMsg) && !prepared.allowUpsert) {
        try {
          const extension = path.extname(prepared.remoteKey).slice(1);
          const { bucket } = this.getBucketForExtension(extension);
          const signedUrl = await this.createSignedUrlWithRetry(bucket, prepared.remoteKey);
          return { publicUrl: signedUrl };
        } catch (urlErr) {
          throw new Error(
            `Upload failed (existing object) and failed to create signed URL: ${urlErr instanceof Error ? urlErr.message : String(urlErr)}`
          );
        }
      }

      throw new Error(`Upload failed: ${errMsg}`);
    } finally {
      await this.cleanupTempFile(prepared.filePath);
    }
  }

  private getBucketForExtension(extension: string): {
    bucket: string;
    config: { maxSizeBytes: number; mimeTypes: Record<string, string> };
  } {
    const normalizedExtension = extension.toLowerCase() as SupportedExtension;

    if (
      (STORAGE_CONFIG.SUPPORTED_EXTENSIONS.images as readonly string[]).includes(
        normalizedExtension
      )
    ) {
      return {
        bucket: this.imagesBucket,
        config: {
          maxSizeBytes: STORAGE_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024,
          mimeTypes: STORAGE_CONFIG.MIME_TYPES,
        },
      };
    }

    if (
      (STORAGE_CONFIG.SUPPORTED_EXTENSIONS.videos as readonly string[]).includes(
        normalizedExtension
      )
    ) {
      return {
        bucket: this.videosBucket,
        config: {
          maxSizeBytes: STORAGE_CONFIG.MAX_VIDEO_SIZE_MB * 1024 * 1024,
          mimeTypes: STORAGE_CONFIG.MIME_TYPES,
        },
      };
    }

    const supported = [
      ...STORAGE_CONFIG.SUPPORTED_EXTENSIONS.images,
      ...STORAGE_CONFIG.SUPPORTED_EXTENSIONS.videos,
    ];

    throw new Error(
      `Unsupported file extension: ${extension}. Supported extensions: ${supported.join(',')}`
    );
  }

  private validateFileSize(fileSizeBytes: number, config: { maxSizeBytes: number }): void {
    if (fileSizeBytes > config.maxSizeBytes) {
      throw new Error(
        `File size ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${(config.maxSizeBytes / 1024 / 1024).toFixed(2)}MB`
      );
    }
  }

  private async uploadStreamWithRetry(
    bucket: string,
    remoteKey: string,
    filePath: string,
    contentType: string,
    allowUpsert: boolean
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= STORAGE_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const nodeStream = fs.createReadStream(filePath);

        let webStream: ReadableStream<Uint8Array>;
        if (typeof Readable.toWeb === 'function') {
          webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
        } else {
          webStream = nodeStream as unknown as ReadableStream<Uint8Array>;
        }

        const { error } = await this.supabase.storage.from(bucket).upload(remoteKey, webStream, {
          upsert: allowUpsert,
          contentType,
        });

        if (error) throw error;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (/resource already exists/i.test(lastError.message) && !allowUpsert) {
          this.logger.info(`Upload skipped (already exists, no upsert): ${remoteKey}`);
          return;
        }

        if (attempt === STORAGE_CONFIG.MAX_RETRIES) break;

        const delay = Math.min(
          STORAGE_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          STORAGE_CONFIG.MAX_RETRY_DELAY_MS
        );
        this.logger.warn(
          `Stream upload attempt ${attempt} failed, retrying in ${delay}ms:`,
          lastError.message
        );
        await this.sleep(delay);
      }
    }

    throw new Error(
      `Stream upload failed after ${STORAGE_CONFIG.MAX_RETRIES} attempts. Last error: ${lastError?.message}`
    );
  }

  private async createSignedUrlWithRetry(bucket: string, remoteKey: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= STORAGE_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const { data: signed, error } = await this.supabase.storage
          .from(bucket)
          .createSignedUrl(remoteKey, STORAGE_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

        if (error || !signed) {
          throw error ?? new Error('Failed to create signed URL');
        }

        return signed.signedUrl;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === STORAGE_CONFIG.MAX_RETRIES) {
          break;
        }

        const delay = Math.min(
          STORAGE_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          STORAGE_CONFIG.MAX_RETRY_DELAY_MS
        );

        this.logger.warn(
          `Signed URL creation attempt ${attempt} failed, retrying in ${delay}ms:`,
          lastError.message
        );
        await this.sleep(delay);
      }
    }

    throw new Error(
      `Signed URL creation failed after ${STORAGE_CONFIG.MAX_RETRIES} attempts. Last error: ${lastError?.message}`
    );
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
