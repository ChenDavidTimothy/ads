import fs from "fs/promises";
import path from "path";

import type { JobManifest } from "./types";

export class ManifestStore {
  private readonly jobCacheDir: string;

  constructor(jobCacheDir: string) {
    this.jobCacheDir = jobCacheDir;
  }

  getManifestPath(): string {
    return path.join(this.jobCacheDir, "manifest.json");
  }

  async save(manifest: JobManifest): Promise<void> {
    await fs.writeFile(this.getManifestPath(), JSON.stringify(manifest, null, 2));
  }

  async load(): Promise<JobManifest | null> {
    try {
      const raw = await fs.readFile(this.getManifestPath(), "utf8");
      return JSON.parse(raw) as JobManifest;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
}
