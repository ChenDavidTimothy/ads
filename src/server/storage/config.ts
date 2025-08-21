// src/server/storage/config.ts
export const STORAGE_CONFIG = {
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  MAX_RETRY_DELAY_MS: 10000,
  
  // Timeout configuration
  UPLOAD_TIMEOUT_MS: 60000, // ✅ CRITICAL FIX: Increased from 30s to 60s for production stability
  SIGNED_URL_EXPIRY_SECONDS: 60 * 60 * 24 * 7, // 7 days
  
  // Cleanup configuration
  TEMP_DIR_CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_TEMP_FILE_AGE_MS: 5 * 60 * 1000, // 5 minutes
  
  // File size limits
  MAX_IMAGE_SIZE_MB: 50,
  MAX_VIDEO_SIZE_MB: 500,
  
  // Supported file types
  SUPPORTED_EXTENSIONS: {
    images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff'],
    videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp']
  },
  
  // MIME types
  MIME_TYPES: {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp'
  }
} as const;

export type SupportedImageExtension = typeof STORAGE_CONFIG.SUPPORTED_EXTENSIONS.images[number];
export type SupportedVideoExtension = typeof STORAGE_CONFIG.SUPPORTED_EXTENSIONS.videos[number];
export type SupportedExtension = SupportedImageExtension | SupportedVideoExtension;
