// src/server/storage/provider.ts
export interface StoragePreparedTarget {
  // Absolute path on local filesystem where the encoder should write
  filePath: string;
  // Remote key/path in the storage backend, e.g. "<userId>/animations/xyz.mp4"
  remoteKey: string;
}

export interface StorageProvider {
  // Prepare a unique local target and remote key for a new artifact
  prepareTarget(extension: string, opts?: { userId?: string }): Promise<StoragePreparedTarget>;
  // Finalize the artifact (e.g., upload to remote storage) and return a public URL
  finalize(prepared: StoragePreparedTarget): Promise<{ publicUrl: string }>;
}


