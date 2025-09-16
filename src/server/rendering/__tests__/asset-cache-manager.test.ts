import fs from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { Readable } from "stream";
import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CachedAsset,
  JobManifest,
} from "@/server/rendering/asset-cache-manager";

type TestAssetRow = {
  id: string;
  user_id: string;
  bucket_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  content_hash?: string;
  image_width?: number;
  image_height?: number;
  created_at: string;
};

const supabaseState: {
  assetRows: TestAssetRow[];
  signedUrl: string;
} = {
  assetRows: [],
  signedUrl: "https://example.com/test",
};

const requestState: {
  bodyFactory: () => Readable;
} = {
  bodyFactory: () => Readable.from([]),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCachedAsset = (value: unknown): value is CachedAsset => {
  if (!isRecord(value)) return false;
  const { assetId, localPath, contentHash, size, contentType, verified } =
    value;
  return (
    typeof assetId === "string" &&
    typeof localPath === "string" &&
    typeof contentHash === "string" &&
    typeof size === "number" &&
    typeof contentType === "string" &&
    typeof verified === "boolean"
  );
};

const isJobManifest = (value: unknown): value is JobManifest => {
  if (!isRecord(value)) return false;
  if (typeof value.jobId !== "string" || typeof value.version !== "string") {
    return false;
  }
  if (
    typeof value.totalBytes !== "number" ||
    typeof value.createdAt !== "string"
  ) {
    return false;
  }
  if (
    "completedAt" in value &&
    value.completedAt !== undefined &&
    typeof value.completedAt !== "string"
  ) {
    return false;
  }
  if (!isRecord(value.assets)) {
    return false;
  }
  return Object.values(value.assets).every(isCachedAsset);
};

vi.mock("@/lib/logger", () => {
  const noop = vi.fn();
  return {
    logger: {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    },
  };
});

type QueryResult = Promise<{ data: TestAssetRow[]; error: null }>;

interface MockQuery {
  select: () => MockQuery;
  in: () => MockQuery;
  eq: () => QueryResult;
}

const createQuery = (): MockQuery => {
  const query: MockQuery = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    eq: vi.fn(async () => ({ data: supabaseState.assetRows, error: null })),
  };
  return query;
};

interface MockStorageBucket {
  createSignedUrl: () => Promise<{ data: { signedUrl: string }; error: null }>;
}

interface MockStorageClient {
  from: (bucket: string) => MockStorageBucket;
}

interface MockSupabaseClient {
  from: (table: string) => MockQuery;
  storage: MockStorageClient;
}

const createStorageBucket = (): MockStorageBucket => ({
  createSignedUrl: vi.fn(async () => ({
    data: { signedUrl: supabaseState.signedUrl },
    error: null,
  })),
});

vi.mock("@/utils/supabase/service", () => {
  const createClient = (): MockSupabaseClient => ({
    from: vi.fn(() => createQuery()),
    storage: {
      from: vi.fn(() => createStorageBucket()),
    },
  });

  return {
    createServiceClient: vi.fn(() => createClient()),
  };
});

vi.mock("undici", () => ({
  request: vi.fn(async () => ({
    body: requestState.bodyFactory(),
  })),
}));

const { AssetCacheManager } = await import(
  "@/server/rendering/asset-cache-manager"
);

describe("AssetCacheManager", () => {
  let jobCacheDir: string;
  let sharedCacheDir: string;

  beforeEach(async () => {
    jobCacheDir = await fs.mkdtemp(path.join(tmpdir(), "job-cache-"));
    sharedCacheDir = await fs.mkdtemp(path.join(tmpdir(), "shared-cache-"));
    supabaseState.assetRows = [];
    requestState.bodyFactory = () => Readable.from([]);
  });

  afterEach(async () => {
    await Promise.allSettled([
      fs.rm(jobCacheDir, { recursive: true, force: true }),
      fs.rm(sharedCacheDir, { recursive: true, force: true }),
    ]);
  });

  it("creates an empty manifest when no assets are requested", async () => {
    const manager = new AssetCacheManager("job-1", "user-1", {
      jobCacheDir,
      sharedCacheDir,
    });

    const manifest = await manager.prepare([]);

    expect(manifest.jobId).toBe("job-1");
    expect(manifest.assets).toEqual({});

    const manifestPath = path.join(jobCacheDir, "manifest.json");
    await expect(fs.access(manifestPath)).rejects.toHaveProperty(
      "code",
      "ENOENT",
    );

    const metrics = manager.getMetrics();
    expect(metrics.assetsRequested).toBe(0);
    expect(metrics.assetsDownloaded).toBe(0);
  });

  it("downloads assets, records metrics, and persists manifest", async () => {
    const fileContent = Buffer.from("hello world");
    const contentHash = createHash("sha256").update(fileContent).digest("hex");

    supabaseState.assetRows = [
      {
        id: "asset-1",
        user_id: "user-1",
        bucket_name: "assets",
        storage_path: "images/sample.png",
        file_size: fileContent.byteLength,
        mime_type: "image/png",
        content_hash: contentHash,
        image_width: 100,
        image_height: 200,
        created_at: new Date().toISOString(),
      },
    ];

    requestState.bodyFactory = () => Readable.from([fileContent]);

    const manager = new AssetCacheManager("job-2", "user-1", {
      jobCacheDir,
      sharedCacheDir,
    });

    const manifest = await manager.prepare(["asset-1", "asset-1"]);

    expect(Object.keys(manifest.assets)).toEqual(["asset-1"]);
    const cachedAsset = manifest.assets["asset-1"];
    if (!cachedAsset) {
      throw new Error("Expected cached asset to be defined");
    }
    expect(cachedAsset.localPath.startsWith(jobCacheDir)).toBe(true);
    expect(cachedAsset.contentHash).toBe(contentHash);
    expect(cachedAsset.size).toBe(fileContent.byteLength);
    expect(cachedAsset.verified).toBe(false);

    const sharedFiles = await fs.readdir(sharedCacheDir);
    expect(sharedFiles.length).toBe(1);

    const metrics = manager.getMetrics();
    expect(metrics.assetsRequested).toBe(1);
    expect(metrics.assetsDownloaded).toBe(1);
    expect(metrics.bytesDownloaded).toBe(fileContent.byteLength);
    expect(metrics.cacheHits).toBe(0);

    const manifestPath = path.join(jobCacheDir, "manifest.json");
    const manifestRaw: unknown = JSON.parse(
      await fs.readFile(manifestPath, "utf8"),
    );
    expect(isJobManifest(manifestRaw)).toBe(true);
    if (!isJobManifest(manifestRaw)) {
      throw new Error("Manifest format mismatch");
    }
    expect(manifestRaw.assets["asset-1"]?.localPath).toBe(
      cachedAsset.localPath,
    );
  });
});
