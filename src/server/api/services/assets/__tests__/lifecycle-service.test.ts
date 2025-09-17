import { describe, expect, it } from 'vitest';
import { createAssetLifecycleService } from '../lifecycle-service';
import type {
  DatabaseResponse,
  DatabaseUserAsset,
  StorageFileInfo,
  StorageResponse,
  SupabaseClientLike,
} from '../types';
import type { QuotaService } from '../quota-service';

const baseQuota = {
  user_id: 'user-1',
  current_usage_bytes: 0,
  quota_limit_bytes: 1000,
  image_count: 0,
  video_count: 0,
  updated_at: new Date().toISOString(),
};

describe('createAssetLifecycleService', () => {
  it('deletes asset and updates quota', async () => {
    const asset: DatabaseUserAsset = {
      id: 'asset-1',
      user_id: 'user-1',
      filename: 'asset-1.png',
      original_name: 'asset-1.png',
      file_size: 123,
      mime_type: 'image/png',
      bucket_name: 'images',
      storage_path: 'user-1/asset-1.png',
      asset_type: 'uploaded',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const selectConditions: Array<{ column: string; value: unknown }> = [];
    const deleteConditions: Array<{ column: string; value: unknown }> = [];

    const selectBuilder = {
      eq(column: string, value: unknown) {
        selectConditions.push({ column, value });
        return selectBuilder;
      },
      async single() {
        return { data: asset, error: null };
      },
    };

    class DeleteBuilder implements PromiseLike<{ error: null }> {
      eq(column: string, value: unknown): this {
        deleteConditions.push({ column, value });
        return this;
      }

      then<TResult1 = { error: null }, TResult2 = never>(
        onfulfilled?: (value: { error: null }) => TResult1 | PromiseLike<TResult1>,
        _onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>
      ): Promise<TResult1 | TResult2> {
        const result: { error: null } = { error: null };
        if (onfulfilled) {
          return Promise.resolve(onfulfilled(result));
        }
        return Promise.resolve(result as unknown as TResult1);
      }
    }

    const deleteBuilder = new DeleteBuilder();

    const storageRemovals: Array<{ bucket: string; paths: string[] }> = [];
    const supabase = {
      from: (table: string) => {
        if (table !== 'user_assets') {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: () => selectBuilder,
          delete: () => deleteBuilder,
        };
      },
      storage: {
        from(bucket: string) {
          return {
            async remove(paths: string[]) {
              storageRemovals.push({ bucket, paths });
              const response: DatabaseResponse<unknown> = {
                data: null,
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
        return {
          user_id: 'user-1',
          current_usage_bytes: 0,
          quota_limit_bytes: 1000,
          image_count: 0,
          video_count: 0,
          updated_at: new Date().toISOString(),
        };
      },
      async updateUserQuota({ fileSize, mimeType }) {
        quotaUpdates.push({ fileSize, mimeType });
      },
    };

    const service = createAssetLifecycleService({ supabase, quotaService });

    await expect(
      service.deleteAsset({
        userId: 'user-1',
        input: { assetId: 'asset-1' },
      })
    ).resolves.toEqual({ success: true });

    expect(selectConditions).toEqual([
      { column: 'id', value: 'asset-1' },
      { column: 'user_id', value: 'user-1' },
    ]);
    expect(deleteConditions).toEqual([
      { column: 'id', value: 'asset-1' },
      { column: 'user_id', value: 'user-1' },
    ]);
    expect(storageRemovals).toEqual([{ bucket: 'images', paths: ['user-1/asset-1.png'] }]);
    expect(quotaUpdates).toEqual([{ fileSize: 123, mimeType: 'image/png' }]);
  });

  it('moves render job output to assets', async () => {
    const selectRenderJobConditions: Array<{ column: string; value: unknown }> = [];

    const renderJobBuilder = {
      select: () => renderJobBuilder,
      eq(column: string, value: unknown) {
        selectRenderJobConditions.push({ column, value });
        return renderJobBuilder;
      },
      async single() {
        const response: DatabaseResponse<{ output_url: string }> = {
          data: {
            output_url: 'https://example.com/storage/v1/object/sign/images/user/file.png',
          },
          error: null,
        };
        return response;
      },
    };

    const existingSelectConditions: Array<{ column: string; value: unknown }> = [];
    const insertRecords: Array<Record<string, unknown>> = [];

    const userAssetsSelector = {
      select: () => userAssetsSelector,
      eq(column: string, value: unknown) {
        existingSelectConditions.push({ column, value });
        return userAssetsSelector;
      },
      limit() {
        return userAssetsSelector;
      },
      async maybeSingle() {
        const response: DatabaseResponse<{ id: string }> = {
          data: null,
          error: null,
        };
        return response;
      },
      async insert(record: Record<string, unknown>) {
        insertRecords.push(record);
        return { error: null };
      },
    };

    const storageLists: Array<{ bucket: string; path: string | undefined }> = [];
    const signedRequests: Array<{
      bucket: string;
      path: string;
      expiresIn: number;
    }> = [];

    const supabase = {
      from: (table: string) => {
        if (table === 'render_jobs') {
          return renderJobBuilder;
        }
        if (table === 'user_assets') {
          return userAssetsSelector;
        }
        throw new Error(`Unexpected table ${table}`);
      },
      storage: {
        from(bucket: string) {
          return {
            async list(path?: string) {
              storageLists.push({ bucket, path });
              return {
                data: [{ name: 'file.png', metadata: { size: 150 } }] as StorageFileInfo[],
                error: null,
              };
            },
            async createSignedUrl(path: string, expiresIn: number) {
              signedRequests.push({ bucket, path, expiresIn });
              const response: DatabaseResponse<StorageResponse> = {
                data: { signedUrl: 'https://signed' },
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
      async updateUserQuota({ fileSize, mimeType }) {
        quotaUpdates.push({ fileSize, mimeType });
      },
    };

    const fetchCalls: Array<{ url: string; method: string }> = [];
    const formatRequestInfo = (input: RequestInfo | URL): string => {
      if (typeof input === 'string') {
        return input;
      }
      if (input instanceof URL) {
        return input.toString();
      }
      if (typeof Request !== 'undefined' && input instanceof Request) {
        return input.url;
      }
      return '[unknown request]';
    };
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({
        url: formatRequestInfo(input),
        method: init?.method ?? 'GET',
      });
      const headers = new Headers({ 'content-length': '150' });
      return new Response(null, { headers });
    };

    const service = createAssetLifecycleService({
      supabase,
      quotaService,
      fetchImpl,
      generateId: () => 'asset-1',
      now: () => new Date('2024-01-01T00:00:00.000Z'),
    });

    const result = await service.moveRenderJobToAssets({
      userId: 'user-1',
      input: {
        renderJobId: 'job-1',
        originalName: 'My Asset.png',
        metadata: {},
      },
    });

    expect(result).toEqual({
      success: true,
      assetId: 'asset-1',
      message: 'Asset saved as "My Asset.png"',
    });
    expect(selectRenderJobConditions).toEqual([
      { column: 'id', value: 'job-1' },
      { column: 'user_id', value: 'user-1' },
      { column: 'status', value: 'completed' },
    ]);
    expect(storageLists).toEqual([{ bucket: 'images', path: 'user' }]);
    expect(signedRequests).toEqual([]);
    expect(fetchCalls).toEqual([]);
    expect(insertRecords).toHaveLength(1);
    expect(quotaUpdates).toEqual([{ fileSize: 150, mimeType: 'image/png' }]);
  });
});
