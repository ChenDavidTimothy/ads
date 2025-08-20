import { z } from "zod";

// Database row types (matching our created schema)
export interface UserAsset {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  bucket_name: string;
  storage_path: string;
  asset_type: 'uploaded' | 'generated_saved';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserStorageQuota {
  user_id: string;
  current_usage_bytes: number;
  quota_limit_bytes: number;
  image_count: number;
  video_count: number;
  updated_at: string;
}

// Input schemas for tRPC endpoints
export const uploadAssetInputSchema = z.object({
  originalName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  assetType: z.enum(['uploaded', 'generated_saved']).default('uploaded'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const listAssetsInputSchema = z.object({
  assetType: z.enum(['uploaded', 'generated_saved', 'all']).optional().default('all'),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
  search: z.string().optional(),
  bucketName: z.enum(['images', 'videos']).optional(),
});

export const deleteAssetInputSchema = z.object({
  assetId: z.string().uuid(),
});

export const moveToAssetsInputSchema = z.object({
  tempFilePath: z.string().min(1),
  originalName: z.string().min(1).max(255),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const getUploadUrlInputSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive(),
});

// Output schemas for tRPC endpoints
export const assetResponseSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  original_name: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  bucket_name: z.string(),
  storage_path: z.string(),
  asset_type: z.enum(['uploaded', 'generated_saved']),
  metadata: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
  public_url: z.string().optional(), // Added by backend
  thumbnail_url: z.string().optional(), // For future image optimization
});

export const listAssetsResponseSchema = z.object({
  assets: z.array(assetResponseSchema),
  total: z.number(),
  hasMore: z.boolean(),
});

export const uploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  assetId: z.string().uuid(),
  expiresAt: z.string(),
});

export const storageQuotaResponseSchema = z.object({
  current_usage_bytes: z.number(),
  quota_limit_bytes: z.number(),
  image_count: z.number(),
  video_count: z.number(),
  usage_percentage: z.number(),
  remaining_bytes: z.number(),
  updated_at: z.string(),
});

// Type exports for use in components
export type UploadAssetInput = z.infer<typeof uploadAssetInputSchema>;
export type ListAssetsInput = z.infer<typeof listAssetsInputSchema>;
export type DeleteAssetInput = z.infer<typeof deleteAssetInputSchema>;
export type MoveToAssetsInput = z.infer<typeof moveToAssetsInputSchema>;
export type GetUploadUrlInput = z.infer<typeof getUploadUrlInputSchema>;

export type AssetResponse = z.infer<typeof assetResponseSchema>;
export type ListAssetsResponse = z.infer<typeof listAssetsResponseSchema>;
export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;
export type StorageQuotaResponse = z.infer<typeof storageQuotaResponseSchema>;

// Utility types
export type AssetType = UserAsset['asset_type'];
export type BucketName = 'images' | 'videos';

// File validation constants (matching STORAGE_CONFIG)
export const ASSET_VALIDATION = {
  MAX_IMAGE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500MB
  SUPPORTED_IMAGE_TYPES: [
    'image/png',
    'image/jpeg', 
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ],
  SUPPORTED_VIDEO_TYPES: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/x-matroska',
    'video/x-m4v',
    'video/3gpp'
  ],
} as const;

// Helper functions
export function isImageMimeType(mimeType: string): boolean {
  return ASSET_VALIDATION.SUPPORTED_IMAGE_TYPES.includes(mimeType as never);
}

export function isVideoMimeType(mimeType: string): boolean {
  return ASSET_VALIDATION.SUPPORTED_VIDEO_TYPES.includes(mimeType as never);
}

export function getBucketForMimeType(mimeType: string): BucketName {
  return isImageMimeType(mimeType) ? 'images' : 'videos';
}

export function getMaxSizeForMimeType(mimeType: string): number {
  return isImageMimeType(mimeType) 
    ? ASSET_VALIDATION.MAX_IMAGE_SIZE 
    : ASSET_VALIDATION.MAX_VIDEO_SIZE;
}

export function validateFileSize(fileSize: number, mimeType: string): boolean {
  const maxSize = getMaxSizeForMimeType(mimeType);
  return fileSize <= maxSize;
}

export function validateMimeType(mimeType: string): boolean {
  return isImageMimeType(mimeType) || isVideoMimeType(mimeType);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function isImage(asset: AssetResponse): boolean {
  return isImageMimeType(asset.mime_type);
}

export function isVideo(asset: AssetResponse): boolean {
  return isVideoMimeType(asset.mime_type);
}
