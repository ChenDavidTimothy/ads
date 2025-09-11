// src/server/rendering/bulk-asset-fetcher.ts
import { createServiceClient } from "@/utils/supabase/service";
import { logger } from "@/lib/logger";

export interface AssetMetadata {
  id: string;
  userId: string;
  bucketName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  contentHash?: string;
  imageWidth?: number;
  imageHeight?: number;
  createdAt: string;
}

export interface ValidationResult {
  valid: boolean;
  totalBytes: number;
  errors: string[];
  warnings: string[];
}

export class BulkAssetFetcher {
  private readonly supabase: ReturnType<typeof createServiceClient>;

  constructor() {
    this.supabase = createServiceClient();
  }

  async bulkFetchAssetMetadata(assetIds: string[], userId: string): Promise<AssetMetadata[]> {
    if (assetIds.length === 0) return [];

    logger.info(`Bulk fetching metadata for ${assetIds.length} assets`, { userId });

    const { data: assets, error } = await this.supabase
      .from("user_assets")
      .select(`
        id, user_id, bucket_name, storage_path,
        file_size, mime_type, content_hash,
        image_width, image_height, created_at
      `)
      .in("id", assetIds)
      .eq("user_id", userId); // Enforce ownership

    if (error) {
      throw new Error(`BULK_FETCH_FAILED: ${error.message}`);
    }

    if (!assets || assets.length === 0) {
      throw new Error("OWNERSHIP_DENIED: No assets found or access denied");
    }

    const foundIds = new Set(assets.map(a => a.id));
    const missingIds = assetIds.filter(id => !foundIds.has(id));

    if (missingIds.length > 0) {
      throw new Error(`ASSET_NOT_FOUND: Assets not found or access denied: ${missingIds.join(", ")}`);
    }

    return assets.map(asset => ({
      id: asset.id,
      userId: asset.user_id,
      bucketName: asset.bucket_name,
      storagePath: asset.storage_path,
      fileSize: asset.file_size || 0,
      mimeType: asset.mime_type,
      contentHash: asset.content_hash || undefined,
      imageWidth: asset.image_width || undefined,
      imageHeight: asset.image_height || undefined,
      createdAt: asset.created_at,
    }));
  }

  validateJobAssets(assets: AssetMetadata[], maxJobSizeBytes: number = 2 * 1024 * 1024 * 1024): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const totalBytes = assets.reduce((sum, asset) => sum + asset.fileSize, 0);

    if (totalBytes > maxJobSizeBytes) {
      errors.push(`SIZE_CAP_EXCEEDED: Job assets exceed size limit: ${this.formatBytes(totalBytes)} > ${this.formatBytes(maxJobSizeBytes)}`);
    }

    const invalidAssets = assets.filter(asset => !asset.bucketName || !asset.storagePath);
    if (invalidAssets.length > 0) {
      errors.push(`INVALID_ASSET_DATA: Invalid asset data for: ${invalidAssets.map(a => a.id).join(", ")}`);
    }

    const assetsWithoutHash = assets.filter(asset => !asset.contentHash);
    if (assetsWithoutHash.length > 0) {
      warnings.push(`${assetsWithoutHash.length} assets lack content hash - using metadata hash fallback`);
    }

    return { valid: errors.length === 0, totalBytes, errors, warnings };
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
