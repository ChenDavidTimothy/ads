// src/server/rendering/path-utils.ts
import path from "node:path";
import fs from "node:fs/promises";

/**
 * Normalizes a path to be absolute and use platform-appropriate separators
 */
export function normalizeDir(p: string): string {
  // Resolve to absolute and normalize separators for the platform
  return path.normalize(path.resolve(p));
}

/**
 * Ensures a directory exists, creating it recursively if necessary
 */
export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

/**
 * Gets platform-appropriate default cache directories
 */
export function getDefaultCacheDirs(): {
  sharedCacheDir: string;
  jobCacheDir: string;
} {
  const isWindows = process.platform === "win32";

  if (isWindows) {
    return {
      sharedCacheDir: "C:\\render\\shared",
      jobCacheDir: "C:\\render\\jobs",
    };
  } else {
    return {
      sharedCacheDir: "/var/cache/render/shared",
      jobCacheDir: "/var/cache/render/jobs",
    };
  }
}
