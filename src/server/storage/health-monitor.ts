// src/server/storage/health-monitor.ts
import { createServiceClient } from '@/utils/supabase/service';

export interface StorageHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  buckets: {
    images: BucketHealth;
    videos: BucketHealth;
  };
  metrics: {
    totalUploads: number;
    successfulUploads: number;
    failedUploads: number;
    averageUploadTime: number;
    lastUploadTime: string | null;
  };
  errors: string[];
}

export interface BucketHealth {
  accessible: boolean;
  fileCount: number;
  totalSize: number;
  lastAccess: string;
  error?: string;
}

export class StorageHealthMonitor {
  private readonly supabase = createServiceClient();
  private readonly imagesBucket: string;
  private readonly videosBucket: string;
  private readonly logger: Console;

  private uploadMetrics = {
    total: 0,
    successful: 0,
    failed: 0,
    uploadTimes: [] as number[],
    lastUpload: null as string | null,
  };

  constructor() {
    this.logger = console;
    this.imagesBucket = process.env.SUPABASE_IMAGES_BUCKET!;
    this.videosBucket = process.env.SUPABASE_VIDEOS_BUCKET!;
  }

  async checkHealth(): Promise<StorageHealthStatus> {
    const timestamp = new Date().toISOString();
    const errors: string[] = [];

    try {
      // Check bucket health
      const [imagesHealth, videosHealth] = await Promise.allSettled([
        this.checkBucketHealth(this.imagesBucket, 'images'),
        this.checkBucketHealth(this.videosBucket, 'videos'),
      ]);

      const buckets = {
        images:
          imagesHealth.status === 'fulfilled'
            ? imagesHealth.value
            : {
                accessible: false,
                fileCount: 0,
                totalSize: 0,
                lastAccess: timestamp,
                error: String(imagesHealth.reason ?? 'Unknown error'),
              },
        videos:
          videosHealth.status === 'fulfilled'
            ? videosHealth.value
            : {
                accessible: false,
                fileCount: 0,
                totalSize: 0,
                lastAccess: timestamp,
                error: String(videosHealth.reason ?? 'Unknown error'),
              },
      };

      // Determine overall status
      let status: StorageHealthStatus['status'] = 'healthy';
      if (!buckets.images.accessible || !buckets.videos.accessible) {
        status = 'unhealthy';
      } else if (this.uploadMetrics.failed > this.uploadMetrics.successful * 0.1) {
        status = 'degraded';
      }

      // Calculate metrics
      const metrics = {
        totalUploads: this.uploadMetrics.total,
        successfulUploads: this.uploadMetrics.successful,
        failedUploads: this.uploadMetrics.failed,
        averageUploadTime:
          this.uploadMetrics.uploadTimes.length > 0
            ? this.uploadMetrics.uploadTimes.reduce((a, b) => a + b, 0) /
              this.uploadMetrics.uploadTimes.length
            : 0,
        lastUploadTime: this.uploadMetrics.lastUpload,
      };

      return {
        status,
        timestamp,
        buckets,
        metrics,
        errors,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');

      return {
        status: 'unhealthy',
        timestamp,
        buckets: {
          images: {
            accessible: false,
            fileCount: 0,
            totalSize: 0,
            lastAccess: timestamp,
            error: 'Health check failed',
          },
          videos: {
            accessible: false,
            fileCount: 0,
            totalSize: 0,
            lastAccess: timestamp,
            error: 'Health check failed',
          },
        },
        metrics: {
          totalUploads: this.uploadMetrics.total,
          successfulUploads: this.uploadMetrics.successful,
          failedUploads: this.uploadMetrics.failed,
          averageUploadTime: 0,
          lastUploadTime: this.uploadMetrics.lastUpload,
        },
        errors,
      };
    }
  }

  private async checkBucketHealth(
    bucketName: string,
    bucketType: 'images' | 'videos'
  ): Promise<BucketHealth> {
    try {
      const startTime = Date.now();

      // List files to check accessibility and get metrics
      const { data: files, error } = await this.supabase.storage
        .from(bucketName)
        .list('', { limit: 1000 }); // Limit to avoid timeout on large buckets

      if (error) {
        throw error;
      }

      // Calculate total size and file count
      let totalSize = 0;
      let fileCount = 0;

      if (files) {
        fileCount = files.length;
        for (const file of files) {
          totalSize += file.metadata?.size ?? 0;
        }
      }

      const lastAccess = new Date().toISOString();

      this.logger.debug(
        `Bucket ${bucketType} health check completed in ${Date.now() - startTime}ms`
      );

      return {
        accessible: true,
        fileCount,
        totalSize,
        lastAccess,
      };
    } catch (error) {
      this.logger.error(`Bucket ${bucketType} health check failed:`, error);
      return {
        accessible: false,
        fileCount: 0,
        totalSize: 0,
        lastAccess: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Call this when uploads start
  recordUploadStart(): void {
    this.uploadMetrics.total++;
    this.uploadMetrics.lastUpload = new Date().toISOString();
  }

  // Call this when uploads complete successfully
  recordUploadSuccess(uploadTimeMs: number): void {
    this.uploadMetrics.successful++;
    this.uploadMetrics.uploadTimes.push(uploadTimeMs);

    // Keep only last 100 upload times for rolling average
    if (this.uploadMetrics.uploadTimes.length > 100) {
      this.uploadMetrics.uploadTimes.shift();
    }
  }

  // Call this when uploads fail
  recordUploadFailure(): void {
    this.uploadMetrics.failed++;
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.uploadMetrics,
      successRate:
        this.uploadMetrics.total > 0
          ? (this.uploadMetrics.successful / this.uploadMetrics.total) * 100
          : 0,
      averageUploadTime:
        this.uploadMetrics.uploadTimes.length > 0
          ? this.uploadMetrics.uploadTimes.reduce((a, b) => a + b, 0) /
            this.uploadMetrics.uploadTimes.length
          : 0,
    };
  }

  // Reset metrics (useful for testing or periodic resets)
  resetMetrics(): void {
    this.uploadMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      uploadTimes: [],
      lastUpload: null,
    };
  }
}
