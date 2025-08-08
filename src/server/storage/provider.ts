// src/server/storage/provider.ts
export interface StorageTarget {
  // Absolute path on local filesystem where the file should be written
  filePath: string;
  // Public URL for accessing the file
  publicUrl: string;
}

export interface StorageProvider {
  // Prepare a unique target path and URL for a new artifact
  prepareTarget(extension: string): Promise<StorageTarget>;
}


