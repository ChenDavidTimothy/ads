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
