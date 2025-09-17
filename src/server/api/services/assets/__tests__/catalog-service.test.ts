import { describe, expect, it, vi } from 'vitest';
import { createAssetCatalogService } from '../catalog-service';
import type {
  DatabaseResponse,
  DatabaseUserAsset,
  StorageFileInfo,
  StorageResponse,
  SupabaseClientLike,
} from '../types';
import type { ListAssetsInput } from '@/shared/types/assets';

type QueryResult = {
  data: DatabaseUserAsset[] | null;
  error: unknown;
  count: number | null;
};

interface QueryBuilder extends PromiseLike<QueryResult> {
  select: (columns: string, options: { count: 'exact' }) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder;
  ilike: (column: string, pattern: string) => QueryBuilder;
}

const createQueryBuilder = (result: QueryResult): QueryBuilder => {
  const builder = {} as QueryBuilder;

  builder.select = vi.fn((_columns: string, _options: { count: 'exact' }) => builder);
  builder.eq = vi.fn((_: string, __: unknown) => builder);
  builder.order = vi.fn((_: string, __: { ascending: boolean }) => builder);
  builder.range = vi.fn((_: number, __: number) => builder);
  builder.ilike = vi.fn((_: string, __: string) => builder);
  builder.then = <T1 = QueryResult, T2 = never>(
    onfulfilled?: (value: QueryResult) => T1 | PromiseLike<T1>,
    _onrejected?: (reason: unknown) => T2 | PromiseLike<T2>
  ): Promise<T1 | T2> => {
    if (onfulfilled) {
      return Promise.resolve(onfulfilled(result));
    }
    return Promise.resolve(result as unknown as T1);
  };

  return builder;
};

type StorageBucket = {
  list: (path?: string) => Promise<{ data: StorageFileInfo[] | null; error: unknown }>;
  createSignedUrl: (path: string, expiresIn: number) => Promise<DatabaseResponse<StorageResponse>>;
};

describe('createAssetCatalogService', () => {
  it('lists assets with signed URLs', async () => {
    const asset: DatabaseUserAsset = {
      id: 'asset-1',
      user_id: 'user-1',
      filename: 'asset-1.png',
      original_name: 'asset-1.png',
      file_size: 100,
      mime_type: 'image/png',
      bucket_name: 'images',
      storage_path: 'user-1/file.png',
      asset_type: 'uploaded',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const builder = createQueryBuilder({
      data: [asset],
      error: null,
      count: 1,
    });

    const storageBucket: StorageBucket = {
      list: vi.fn<(path?: string) => Promise<{ data: StorageFileInfo[] | null; error: unknown }>>(
        async () => ({
          data: [{ name: 'file.png', metadata: { size: 100 } }],
          error: null,
        })
      ),
      createSignedUrl: vi.fn<
        (path: string, expiresIn: number) => Promise<DatabaseResponse<StorageResponse>>
      >(async () => ({
        data: { signedUrl: 'https://signed' },
        error: null,
      })),
    };

    const storageFrom = vi.fn<(bucket: string) => StorageBucket>(() => storageBucket);

    const supabase = {
      from: vi.fn<(table: string) => QueryBuilder>((table) => {
        if (table !== 'user_assets') {
          throw new Error(`Unexpected table ${table}`);
        }
        return builder;
      }),
      storage: { from: storageFrom },
    } as unknown as SupabaseClientLike;

    const service = createAssetCatalogService({ supabase });

    const input: ListAssetsInput = { assetType: 'all', limit: 50, offset: 0 };
    const result = await service.listAssets({ userId: 'user-1', input });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      id: 'asset-1',
      public_url: 'https://signed',
    });
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(storageFrom).toHaveBeenCalledWith('images');
  });

  it('filters assets missing in storage', async () => {
    const asset: DatabaseUserAsset = {
      id: 'asset-1',
      user_id: 'user-1',
      filename: 'asset-1.png',
      original_name: 'asset-1.png',
      file_size: 100,
      mime_type: 'image/png',
      bucket_name: 'images',
      storage_path: 'user-1/file.png',
      asset_type: 'uploaded',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const builder = createQueryBuilder({
      data: [asset],
      error: null,
      count: 1,
    });

    const storageBucket: StorageBucket = {
      list: vi.fn<(path?: string) => Promise<{ data: StorageFileInfo[] | null; error: unknown }>>(
        async () => ({
          data: [],
          error: null,
        })
      ),
      createSignedUrl: vi.fn<
        (path: string, expiresIn: number) => Promise<DatabaseResponse<StorageResponse>>
      >(async () => ({ data: null, error: null })),
    };

    const supabase = {
      from: vi.fn<(table: string) => QueryBuilder>((table) => {
        if (table !== 'user_assets') {
          throw new Error(`Unexpected table ${table}`);
        }
        return builder;
      }),
      storage: {
        from: vi.fn<(bucket: string) => StorageBucket>(() => storageBucket),
      },
    } as unknown as SupabaseClientLike;

    const service = createAssetCatalogService({ supabase });

    const input: ListAssetsInput = { assetType: 'all', limit: 50, offset: 0 };
    const result = await service.listAssets({ userId: 'user-1', input });

    expect(result.assets).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(true);
  });
});
