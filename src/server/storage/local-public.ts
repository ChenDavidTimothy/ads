// src/server/storage/local-public.ts
import path from 'path';
import fs from 'fs';
import type { StorageProvider, StoragePreparedTarget } from './provider';
import { sanitizeForFilename } from '@/shared/utils/naming';

function generateUniqueName(prefix: string, extension: string): string {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}_${unique}.${extension}`;
}

export class LocalPublicStorageProvider implements StorageProvider {
  private readonly publicDir: string;
  private readonly publicBaseUrl: string;
  private readonly subDir: string;

  constructor(options?: { publicDir?: string; publicBaseUrl?: string; subDir?: string }) {
    this.publicDir = options?.publicDir ?? path.join(process.cwd(), 'public');
    this.publicBaseUrl = options?.publicBaseUrl ?? '/';
    this.subDir = options?.subDir ?? 'animations';
  }

  async prepareTarget(
    extension: string,
    opts?: { userId?: string; basename?: string; subdir?: string }
  ): Promise<StoragePreparedTarget> {
    const effectiveSubdir = opts?.subdir ?? this.subDir;
    const dir = path.join(this.publicDir, effectiveSubdir);
    await fs.promises.mkdir(dir, { recursive: true });
    const base = sanitizeBasename(opts?.basename) ?? 'scene';
    const filename = generateUniqueName(base, extension);
    const filePath = path.join(dir, filename);
    const remoteKey = path.posix.join(effectiveSubdir, filename);
    return { filePath, remoteKey };
  }

  async finalize(
    prepared: StoragePreparedTarget,
    _opts?: { contentType?: string }
  ): Promise<{ publicUrl: string }> {
    const publicUrl = path.posix.join('/', prepared.remoteKey);
    return { publicUrl };
  }
}

function sanitizeBasename(input?: string): string | undefined {
  if (!input) return undefined;
  const replaced = sanitizeForFilename(input);
  return replaced.length > 0 ? replaced : undefined;
}
