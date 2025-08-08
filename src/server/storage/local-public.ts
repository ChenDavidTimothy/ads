// src/server/storage/local-public.ts
import path from "path";
import fs from "fs";
import type { StorageProvider, StoragePreparedTarget } from "./provider";

function generateUniqueName(prefix: string, extension: string): string {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}_${unique}.${extension}`;
}

export class LocalPublicStorageProvider implements StorageProvider {
  private readonly publicDir: string;
  private readonly publicBaseUrl: string;
  private readonly subDir: string;

  constructor(options?: { publicDir?: string; publicBaseUrl?: string; subDir?: string }) {
    this.publicDir = options?.publicDir ?? path.join(process.cwd(), "public");
    this.publicBaseUrl = options?.publicBaseUrl ?? "/";
    this.subDir = options?.subDir ?? "animations";
  }

  async prepareTarget(extension: string): Promise<StoragePreparedTarget> {
    const dir = path.join(this.publicDir, this.subDir);
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = generateUniqueName("scene", extension);
    const filePath = path.join(dir, filename);
    const remoteKey = path.posix.join(this.subDir, filename);
    return { filePath, remoteKey };
  }

  async finalize(prepared: StoragePreparedTarget): Promise<{ publicUrl: string }> {
    const publicUrl = path.posix.join("/", prepared.remoteKey);
    return { publicUrl };
  }
}


