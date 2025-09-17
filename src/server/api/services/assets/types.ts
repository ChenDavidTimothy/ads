import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserAsset, UserStorageQuota } from "@/shared/types/assets";

export interface DatabaseResponse<T> {
  data: T | null;
  error: unknown;
}

export interface StorageResponse {
  signedUrl: string;
}

export interface StorageFileInfo {
  name: string;
  metadata?: {
    size?: number;
  };
}

export type QuotaRecord = UserStorageQuota;

export type DatabaseUserAsset = UserAsset & { updated_at: string };

export type SupabaseClientLike = SupabaseClient;

