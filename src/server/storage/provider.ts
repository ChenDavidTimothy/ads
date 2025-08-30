// src/server/storage/provider.ts
export interface StoragePreparedTarget {
  // Absolute path on local filesystem where the encoder should write
  filePath: string;
  // Remote key/path in the storage backend, e.g. "<userId>/xyz.mp4"
  remoteKey: string;
  // Whether to allow overwriting existing files during upload
  allowUpsert?: boolean;
}

export interface FinalizeOptions {
  contentType?: string;
}

export interface StorageProvider {
  // Prepare a unique local target and remote key for a new artifact
  prepareTarget(
    extension: string,
    opts?: { userId?: string; basename?: string; subdir?: string; allowUpsert?: boolean },
  ): Promise<StoragePreparedTarget>;
  // Finalize the artifact (e.g., upload to remote storage) and return a public URL
  finalize(
    prepared: StoragePreparedTarget,
    opts?: FinalizeOptions,
  ): Promise<{ publicUrl: string }>;
}
