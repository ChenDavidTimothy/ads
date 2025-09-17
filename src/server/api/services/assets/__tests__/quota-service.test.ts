import { describe, expect, it, vi } from 'vitest';
import { createQuotaService } from '../quota-service';
import { AssetsServiceError } from '../errors';
import type { QuotaRecord, SupabaseClientLike } from '../types';

function createQuotaRecord(overrides: Partial<QuotaRecord> = {}): QuotaRecord {
  return {
    user_id: 'user-1',
    current_usage_bytes: 123,
    quota_limit_bytes: 456,
    image_count: 3,
    video_count: 4,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('createQuotaService', () => {
  it('returns existing quota when present', async () => {
    const quota = createQuotaRecord();

    const single = vi.fn().mockResolvedValue({ data: quota, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });

    const supabase = {
      from: vi.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClientLike;

    const service = createQuotaService({ supabase });

    await expect(service.getOrCreateUserQuota('user-1')).resolves.toEqual(quota);
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(single).toHaveBeenCalled();
  });

  it('creates quota when missing', async () => {
    const quota = createQuotaRecord();

    const fetchSingle = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    const fetchEq = vi.fn().mockReturnValue({ single: fetchSingle });
    const fetchSelect = vi.fn().mockReturnValue({ eq: fetchEq });

    const insertSingle = vi.fn().mockResolvedValue({ data: quota, error: null });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: fetchSelect,
        insert,
      }),
    } as unknown as SupabaseClientLike;

    const service = createQuotaService({ supabase });

    await expect(service.getOrCreateUserQuota('user-1')).resolves.toEqual(quota);
    expect(fetchSingle).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
    expect(insertSelect).toHaveBeenCalled();
    expect(insertSingle).toHaveBeenCalled();
  });

  it('updates quota for image add', async () => {
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                current_usage_bytes: 100,
                image_count: 2,
                video_count: 5,
              },
              error: null,
            }),
          }),
        }),
        update: updateFn,
      }),
    } as unknown as SupabaseClientLike;

    const service = createQuotaService({ supabase });

    await service.updateUserQuota({
      userId: 'user-1',
      fileSize: 10,
      mimeType: 'image/png',
      operation: 'add',
    });

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        current_usage_bytes: 110,
        image_count: 3,
        video_count: 5,
      })
    );
  });

  it('throws AssetsServiceError when fetch fails', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'boom' },
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClientLike;

    const service = createQuotaService({ supabase });

    await expect(
      service.updateUserQuota({
        userId: 'user-1',
        fileSize: 10,
        mimeType: 'video/mp4',
        operation: 'add',
      })
    ).rejects.toBeInstanceOf(AssetsServiceError);
  });
});
