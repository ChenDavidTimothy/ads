import type {
  DatabaseResponse,
  DatabaseUserAsset,
  StorageResponse,
  SupabaseClientLike,
} from './types';
import { AssetsServiceError } from './errors';
import type { ListAssetsInput, AssetResponse } from '@/shared/types/assets';

interface LoggerLike {
  warn?: (message: string, meta?: Record<string, unknown>) => void;
}

export interface AssetCatalogServiceDeps {
  supabase: SupabaseClientLike;
  logger?: LoggerLike;
}

export interface ListAssetsParams {
  userId: string;
  input: ListAssetsInput;
}

export interface ListAssetsResult {
  assets: AssetResponse[];
  total: number;
  hasMore: boolean;
}

export function createAssetCatalogService({ supabase, logger }: AssetCatalogServiceDeps) {
  const log = logger ?? console;

  async function listAssets({ userId, input }: ListAssetsParams): Promise<ListAssetsResult> {
    let query = supabase
      .from('user_assets')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.assetType && input.assetType !== 'all') {
      query = query.eq('asset_type', input.assetType);
    }

    if (input.bucketName) {
      query = query.eq('bucket_name', input.bucketName);
    }

    if (input.search) {
      query = query.ilike('original_name', `%${input.search}%`);
    }

    const result = await query;
    const {
      data: assets,
      error,
      count,
    } = result as {
      data: DatabaseUserAsset[] | null;
      error: unknown;
      count: number | null;
    };

    if (error) {
      throw new AssetsServiceError('INTERNAL_SERVER_ERROR', 'Failed to fetch assets', {
        cause: error,
      });
    }

    const typedAssets: DatabaseUserAsset[] = assets ?? [];

    const maybeAssets: Array<AssetResponse | null> = await Promise.all(
      typedAssets.map(async (asset: DatabaseUserAsset) => {
        try {
          const signedUrlResult = (await supabase.storage
            .from(asset.bucket_name)
            .createSignedUrl(
              asset.storage_path,
              60 * 60 * 24
            )) as DatabaseResponse<StorageResponse>;

          const signedUrl = signedUrlResult.data?.signedUrl ?? null;
          const signError: unknown = signedUrlResult.error;

          if (signError || !signedUrl) {
            log.warn?.(`Failed to create signed URL for asset ${asset.id}`, {
              bucket: asset.bucket_name,
              path: asset.storage_path,
              error: signError ? serializeError(signError) : 'No URL returned',
            });
            return null;
          }

          const assetWithUrl: AssetResponse = {
            id: asset.id,
            filename: asset.filename,
            original_name: asset.original_name,
            file_size: asset.file_size,
            mime_type: asset.mime_type,
            bucket_name: asset.bucket_name,
            storage_path: asset.storage_path,
            asset_type: asset.asset_type,
            metadata: coerceRecord(asset.metadata),
            created_at: asset.created_at,
            public_url: signedUrl,
            image_width: coerceDimension(asset.image_width),
            image_height: coerceDimension(asset.image_height),
          };

          return assetWithUrl;
        } catch (error) {
          log.warn?.(`Asset ${asset.id} reconciliation failed`, {
            error: serializeError(error),
          });
          return null;
        }
      })
    );

    const assetsWithUrls: AssetResponse[] = maybeAssets.filter(
      (asset): asset is AssetResponse => asset !== null
    );

    const totalCount = count ?? typedAssets.length;
    const hasMore = input.offset + typedAssets.length < totalCount;

    return {
      assets: assetsWithUrls,
      total: totalCount,
      hasMore,
    };
  }

  return {
    listAssets,
  };
}

function coerceRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function coerceDimension(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function serializeError(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable error object]';
    }
  }
  return '[unknown error]';
}
