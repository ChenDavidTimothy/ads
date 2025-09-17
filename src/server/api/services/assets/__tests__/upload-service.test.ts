import { describe, expect, it } from "vitest";
import { createAssetUploadService } from "../upload-service";
import { AssetsServiceError } from "../errors";
import type {
  DatabaseResponse,
  DatabaseUserAsset,
  StorageResponse,
  SupabaseClientLike,
} from "../types";
import type { QuotaService } from "../quota-service";

const baseQuota = {
  user_id: "user-1",
  current_usage_bytes: 0,
  quota_limit_bytes: 1000,
  image_count: 0,
  video_count: 0,
  updated_at: new Date().toISOString(),
};

describe("createAssetUploadService", () => {
  it("prepares upload and pre-registers asset", async () => {
    const recordedBuckets: string[] = [];
    const recordedPaths: string[] = [];
    const insertedRecords: Array<Record<string, unknown>> = [];

    const supabase = {
      storage: {
        from(bucket: string) {
          recordedBuckets.push(bucket);
          return {
            async createSignedUploadUrl(path: string) {
              recordedPaths.push(path);
              const response: DatabaseResponse<StorageResponse> = {
                data: { signedUrl: "https://upload" },
                error: null,
              };
              return response;
            },
          };
        },
      },
      from(table: string) {
        if (table !== "user_assets") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          async insert(record: Record<string, unknown>) {
            insertedRecords.push(record);
            return { error: null };
          },
        };
      },
    } as unknown as SupabaseClientLike;

    const quotaCalls: Array<{ type: "get" | "update"; userId: string }> = [];
    const quotaService: QuotaService = {
      async getOrCreateUserQuota(userId) {
        quotaCalls.push({ type: "get", userId });
        return baseQuota;
      },
      async updateUserQuota({ userId }) {
        quotaCalls.push({ type: "update", userId });
      },
    };

    const service = createAssetUploadService({
      supabase,
      quotaService,
      generateId: () => "asset-1234",
      now: () => new Date("2024-01-01T00:00:00.000Z"),
    });

    const result = await service.prepareUpload({
      userId: "user-1",
      input: {
        filename: "photo.png",
        mimeType: "image/png",
        fileSize: 100,
      },
    });

    expect(result).toEqual({
      assetId: "asset-1234",
      uploadUrl: "https://upload",
      expiresAt: "2024-01-01T01:00:00.000Z",
    });
    expect(quotaCalls).toEqual([
      { type: "get", userId: "user-1" },
    ]);
    expect(recordedBuckets).toEqual(["images"]);
    expect(recordedPaths).toEqual(["user-1/upl_asset1234/asset-1234.png"]);
    expect(insertedRecords).toHaveLength(1);
  });

  it("throws on unsupported mime type", async () => {
    const quotaService: QuotaService = {
      async getOrCreateUserQuota() {
        throw new Error("should not be called");
      },
      async updateUserQuota() {
        throw new Error("should not be called");
      },
    };

    const service = createAssetUploadService({
      supabase: {} as SupabaseClientLike,
      quotaService,
    });

    await expect(
      service.prepareUpload({
        userId: "user-1",
        input: {
          filename: "file.xyz",
          mimeType: "application/unknown",
          fileSize: 1,
        },
      }),
    ).rejects.toBeInstanceOf(AssetsServiceError);
  });

  it("confirms upload, updates quota, and stores metadata", async () => {
    const asset: DatabaseUserAsset = {
      id: "asset-1",
      user_id: "user-1",
      filename: "asset-1.png",
      original_name: "asset-1.png",
      file_size: 200,
      mime_type: "image/png",
      bucket_name: "images",
      storage_path: "user-1/upl_asset1/asset-1.png",
      asset_type: "uploaded",
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const selectCalls: Array<{ column: string; value: unknown }> = [];
    const updateRecords: Array<Record<string, unknown>> = [];
    const updateWhere: Array<{ column: string; value: unknown }> = [];

    const userAssetsTable = {
      select(columns: string) {
        if (columns !== "*") {
          throw new Error(`Unexpected columns ${columns}`);
        }
        return {
          eq(column: string, value: unknown) {
            selectCalls.push({ column, value });
            return this;
          },
          async single() {
            const response: DatabaseResponse<DatabaseUserAsset> = {
              data: asset,
              error: null,
            };
            return response;
          },
        };
      },
      update(values: Record<string, unknown>) {
        updateRecords.push(values);
        return {
          async eq(column: string, value: unknown) {
            updateWhere.push({ column, value });
            return { error: null };
          },
        };
      },
    };

    const storageRequests: Array<{ bucket: string; path: string; expiresIn: number }> = [];
    const supabase = {
      from(table: string) {
        if (table !== "user_assets") {
          throw new Error(`Unexpected table ${table}`);
        }
        return userAssetsTable;
      },
      storage: {
        from(bucket: string) {
          return {
            async createSignedUrl(path: string, expiresIn: number) {
              storageRequests.push({ bucket, path, expiresIn });
              const response: DatabaseResponse<StorageResponse> = {
                data: { signedUrl: "https://signed" },
                error: null,
              };
              return response;
            },
          };
        },
      },
    } as unknown as SupabaseClientLike;

    const quotaUpdates: Array<{ fileSize: number; mimeType: string }> = [];
    const quotaService: QuotaService = {
      async getOrCreateUserQuota() {
        return baseQuota;
      },
      async updateUserQuota({ fileSize, mimeType, userId }) {
        quotaUpdates.push({ fileSize, mimeType });
        if (userId !== "user-1") {
          throw new Error("unexpected user");
        }
      },
    };

    const fetchCalls: string[] = [];
    const formatRequestInfo = (input: RequestInfo | URL): string => {
      if (typeof input === "string") {
        return input;
      }
      if (input instanceof URL) {
        return input.toString();
      }
      if (typeof Request !== "undefined" && input instanceof Request) {
        return input.url;
      }
      return "[unknown request]";
    };
    const fetchImpl = async (input: RequestInfo | URL) => {
      fetchCalls.push(formatRequestInfo(input));
      return new Response(new Uint8Array(new ArrayBuffer(8)));
    };

    let metadataProbeCalls = 0;
    const metadataProbe = async () => {
      metadataProbeCalls += 1;
      return { width: 100, height: 50 };
    };

    const service = createAssetUploadService({
      supabase,
      quotaService,
      fetchImpl,
      metadataProbe,
    });

    const response = await service.confirmUpload({
      userId: "user-1",
      input: {
        assetId: "asset-1",
        originalName: "asset-1.png",
        fileSize: 200,
        mimeType: "image/png",
        assetType: "uploaded",
        metadata: {},
      },
    });

    expect(response).toEqual({ success: true });
    expect(selectCalls).toEqual([
      { column: "id", value: "asset-1" },
      { column: "user_id", value: "user-1" },
    ]);
    expect(storageRequests).toEqual([
      { bucket: "images", path: "user-1/upl_asset1/asset-1.png", expiresIn: 300 },
    ]);
    expect(fetchCalls).toEqual(["https://signed"]);
    expect(metadataProbeCalls).toBe(1);
    expect(updateRecords).toEqual([
      { image_width: 100, image_height: 50 },
    ]);
    expect(updateWhere).toEqual([
      { column: "id", value: "asset-1" },
    ]);
    expect(quotaUpdates).toEqual([
      { fileSize: 200, mimeType: "image/png" },
    ]);
  });
});
