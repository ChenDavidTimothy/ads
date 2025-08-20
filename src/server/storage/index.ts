// src/server/storage/index.ts
export { SmartStorageProvider } from './smart-storage-provider';
export { StorageHealthMonitor } from './health-monitor';
export { StorageErrorHandler, StorageErrorCode } from './error-handler';
export { STORAGE_CONFIG } from './config';
export type { StorageProvider, StoragePreparedTarget, FinalizeOptions } from './provider';
export type { StorageHealthStatus, BucketHealth } from './health-monitor';
export type { StorageError } from './error-handler';
export type { SupportedExtension, SupportedImageExtension, SupportedVideoExtension } from './config';

// Cleanup service is managed by the service registry
// Import from services/service-registry instead
