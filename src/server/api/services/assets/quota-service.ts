import type { SupabaseClientLike, DatabaseResponse, QuotaRecord } from './types';
import { AssetsServiceError } from './errors';

type LoggerLike = {
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

export interface QuotaServiceDeps {
  supabase: SupabaseClientLike;
  logger?: LoggerLike;
}

export interface UpdateQuotaParams {
  userId: string;
  fileSize: number;
  mimeType: string;
  operation: 'add' | 'subtract';
}

export interface QuotaService {
  getOrCreateUserQuota(userId: string): Promise<QuotaRecord>;
  updateUserQuota(params: UpdateQuotaParams): Promise<void>;
}

const DEFAULT_QUOTA_LIMIT_BYTES = 1073741824; // 1GB default

export function createQuotaService({ supabase, logger }: QuotaServiceDeps): QuotaService {
  const log = logger ?? console;

  async function getOrCreateUserQuota(userId: string): Promise<QuotaRecord> {
    const result = await supabase
      .from('user_storage_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: quota, error } = result as DatabaseResponse<QuotaRecord>;

    if (error && (error as { code?: string }).code === 'PGRST116') {
      const insertResult = await supabase
        .from('user_storage_quotas')
        .insert({
          user_id: userId,
          current_usage_bytes: 0,
          quota_limit_bytes: DEFAULT_QUOTA_LIMIT_BYTES,
          image_count: 0,
          video_count: 0,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      const { data: newQuota, error: createError } = insertResult as DatabaseResponse<QuotaRecord>;

      if (createError) {
        log.error?.('Failed to create quota record', { createError, userId });
        throw new AssetsServiceError('INTERNAL_SERVER_ERROR', 'Failed to create quota record', {
          cause: createError,
        });
      }

      if (!newQuota) {
        throw new AssetsServiceError(
          'INTERNAL_SERVER_ERROR',
          'Quota record created but no data returned'
        );
      }

      ensureQuotaRecordShape(newQuota);
      return newQuota;
    }

    if (error) {
      log.error?.('Failed to fetch quota', { error, userId });
      throw new AssetsServiceError('INTERNAL_SERVER_ERROR', 'Failed to fetch quota', {
        cause: error,
      });
    }

    if (!quota) {
      throw new AssetsServiceError('INTERNAL_SERVER_ERROR', 'No quota data returned');
    }

    ensureQuotaRecordShape(quota);
    return quota;
  }

  async function updateUserQuota({
    userId,
    fileSize,
    mimeType,
    operation,
  }: UpdateQuotaParams): Promise<void> {
    const isImage = mimeType.startsWith('image/');
    const sizeDelta = operation === 'add' ? fileSize : -fileSize;
    const countDelta = operation === 'add' ? 1 : -1;

    const result = await supabase
      .from('user_storage_quotas')
      .select('current_usage_bytes, image_count, video_count')
      .eq('user_id', userId)
      .single();

    const { data: currentQuota, error: fetchError } = result as DatabaseResponse<
      Pick<QuotaRecord, 'current_usage_bytes' | 'image_count' | 'video_count'>
    >;

    if (fetchError) {
      throw new AssetsServiceError('INTERNAL_SERVER_ERROR', 'Failed to fetch current quota', {
        cause: fetchError,
      });
    }

    if (
      !currentQuota ||
      typeof currentQuota.current_usage_bytes !== 'number' ||
      typeof currentQuota.image_count !== 'number' ||
      typeof currentQuota.video_count !== 'number'
    ) {
      throw new AssetsServiceError('INTERNAL_SERVER_ERROR', 'Invalid quota data format');
    }

    const newUsage = currentQuota.current_usage_bytes + sizeDelta;
    const newImageCount = isImage
      ? currentQuota.image_count + countDelta
      : currentQuota.image_count;
    const newVideoCount = !isImage
      ? currentQuota.video_count + countDelta
      : currentQuota.video_count;

    const { error } = await supabase
      .from('user_storage_quotas')
      .update({
        current_usage_bytes: Math.max(0, newUsage),
        image_count: Math.max(0, newImageCount),
        video_count: Math.max(0, newVideoCount),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      throw new AssetsServiceError('INTERNAL_SERVER_ERROR', 'Failed to update quota', {
        cause: error,
      });
    }
  }

  return {
    getOrCreateUserQuota,
    updateUserQuota,
  };
}

function ensureQuotaRecordShape(record: QuotaRecord): void {
  if (
    typeof record.current_usage_bytes !== 'number' ||
    typeof record.quota_limit_bytes !== 'number' ||
    typeof record.image_count !== 'number' ||
    typeof record.video_count !== 'number' ||
    typeof record.updated_at !== 'string'
  ) {
    throw new AssetsServiceError('INTERNAL_SERVER_ERROR', 'Invalid quota data format');
  }
}
