import { randomUUID } from "crypto";
import type {
  DatabaseResponse,
  DatabaseUserAsset,
  StorageFileInfo,
  StorageResponse,
  SupabaseClientLike,
} from "./types";
import { AssetsServiceError } from "./errors";
import type { QuotaService } from "./quota-service";
import type { DeleteAssetInput, MoveToAssetsInput } from "@/shared/types/assets";
import { parseSignedUrl } from "./utils";

interface LoggerLike {
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  info?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
}

export interface AssetLifecycleServiceDeps {
  supabase: SupabaseClientLike;
  quotaService: QuotaService;
  logger?: LoggerLike;
  fetchImpl?: typeof fetch;
  generateId?: () => string;
  now?: () => Date;
}

export interface DeleteAssetParams {
  userId: string;
  input: DeleteAssetInput;
}

export interface MoveToAssetsParams {
  userId: string;
  input: MoveToAssetsInput;
}

export interface DeleteAssetResult {
  success: true;
}

export interface MoveToAssetsResult {
  success: true;
  assetId: string;
  message: string;
}

export function createAssetLifecycleService({
  supabase,
  quotaService,
  logger,
  fetchImpl,
  generateId,
  now,
}: AssetLifecycleServiceDeps) {
  const log = logger ?? console;
  const fetchFn = fetchImpl ?? fetch;
  const idGenerator = generateId ?? randomUUID;
  const nowFn = now ?? (() => new Date());

  async function deleteAsset({ userId, input }: DeleteAssetParams): Promise<DeleteAssetResult> {
    const result = await supabase
      .from("user_assets")
      .select("*")
      .eq("id", input.assetId)
      .eq("user_id", userId)
      .single();

    const { data: asset, error: fetchError } = result as DatabaseResponse<
      DatabaseUserAsset
    >;

    if (fetchError || !asset) {
      throw new AssetsServiceError("NOT_FOUND", "Asset not found", {
        cause: fetchError,
      });
    }

    if (
      typeof asset.bucket_name !== "string" ||
      typeof asset.storage_path !== "string"
    ) {
      throw new AssetsServiceError(
        "INTERNAL_SERVER_ERROR",
        "Invalid asset data",
      );
    }

    const { error: storageError } = await supabase.storage
      .from(asset.bucket_name)
      .remove([asset.storage_path]);

    if (storageError) {
      throw new AssetsServiceError(
        "INTERNAL_SERVER_ERROR",
        "Failed to delete file from storage",
        { cause: storageError },
      );
    }

    const { error: dbError } = await supabase
      .from("user_assets")
      .delete()
      .eq("id", input.assetId)
      .eq("user_id", userId);

    if (dbError) {
      throw new AssetsServiceError(
        "INTERNAL_SERVER_ERROR",
        "Failed to delete asset record",
        { cause: dbError },
      );
    }

    if (
      typeof asset.file_size === "number" &&
      typeof asset.mime_type === "string"
    ) {
      await quotaService.updateUserQuota({
        userId,
        fileSize: asset.file_size,
        mimeType: asset.mime_type,
        operation: "subtract",
      });
    }

    return { success: true };
  }

  async function moveRenderJobToAssets({
    userId,
    input,
  }: MoveToAssetsParams): Promise<MoveToAssetsResult> {
    const jobResult = await supabase
      .from("render_jobs")
      .select("*")
      .eq("id", input.renderJobId)
      .eq("user_id", userId)
      .eq("status", "completed")
      .single();

    const { data: renderJob, error: jobError } = jobResult as DatabaseResponse<
      { output_url: string }
    >;

    if (jobError || !renderJob?.output_url) {
      throw new AssetsServiceError(
        "NOT_FOUND",
        "Render job not found or not completed",
        { cause: jobError },
      );
    }

    if (typeof renderJob.output_url !== "string") {
      throw new AssetsServiceError(
        "INTERNAL_SERVER_ERROR",
        "Invalid output URL format",
      );
    }

    const { bucket, filePath, mimeType, extension } = parseSignedUrl(
      renderJob.output_url,
    );

    if (!bucket || !filePath) {
      throw new AssetsServiceError(
        "BAD_REQUEST",
        "Invalid output URL format",
      );
    }

    const filename = filePath.split("/").pop();
    const parentDir = filePath.includes("/")
      ? filePath.slice(0, filePath.lastIndexOf("/"))
      : "";

    const listResult = await supabase.storage
      .from(bucket)
      .list(parentDir);
    const { data: dirEntries, error: fileError } = listResult as {
      data: StorageFileInfo[] | null;
      error: unknown;
    };

    if (fileError || !dirEntries || dirEntries.length === 0 || !filename) {
      throw new AssetsServiceError(
        "NOT_FOUND",
        "File not found in storage",
        { cause: fileError },
      );
    }

    const fileData = dirEntries.find((entry: StorageFileInfo) => entry.name === filename);
    if (!fileData) {
      throw new AssetsServiceError(
        "NOT_FOUND",
        "File metadata not found",
      );
    }

    let fileSize = fileData.metadata?.size ?? 0;
    if (!fileSize || fileSize <= 0) {
      const { data: signed } = (await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60)) as DatabaseResponse<StorageResponse>;

      if (signed?.signedUrl) {
        try {
          const head = await fetchFn(signed.signedUrl, { method: "HEAD" });
          const len = head.headers.get("content-length");
          const parsed = len ? Number(len) : 0;
          if (Number.isFinite(parsed) && parsed > 0) {
            fileSize = parsed;
          }
        } catch {
          // ignore; will fallback below
        }
      }

      if (!fileSize || fileSize <= 0) {
        fileSize = 1;
      }
    }

    const assetId = idGenerator();
    const assetName =
      input.originalName ?? `Generated_${nowFn().getTime()}.${extension}`;

    const existing = (await supabase
      .from("user_assets")
      .select("id")
      .eq("user_id", userId)
      .eq("storage_path", filePath)
      .limit(1)
      .maybeSingle()) as DatabaseResponse<{ id: string }>;
    if (existing?.data?.id) {
      return {
        success: true,
        assetId: existing.data.id,
        message: `Asset already saved as "${assetName}"`,
      };
    }

    const { error: insertError } = await supabase
      .from("user_assets")
      .insert({
        id: assetId,
        user_id: userId,
        filename: filePath.split("/").pop() ?? assetName,
        original_name: assetName,
        file_size: fileSize,
        mime_type: mimeType,
        bucket_name: bucket,
        storage_path: filePath,
        asset_type: "generated_saved" as const,
        metadata: {
          ...input.metadata,
          source: "render_job",
          render_job_id: input.renderJobId,
          saved_at: nowFn().toISOString(),
        },
      });

    if (insertError) {
      log.error?.("user_assets insert failed", {
        error: insertError,
        userId,
        assetId,
        bucket,
        filePath,
        fileSize,
        mimeType,
      });
      throw new AssetsServiceError(
        "INTERNAL_SERVER_ERROR",
        "Failed to save asset record",
        { cause: insertError },
      );
    }

    await quotaService.updateUserQuota({
      userId,
      fileSize,
      mimeType,
      operation: "add",
    });

    log.info?.("Asset saved successfully", {
      assetId,
      renderJobId: input.renderJobId,
      userId,
      bucket,
      filePath,
    });

    return {
      success: true,
      assetId,
      message: `Asset saved as "${assetName}"`,
    };
  }

  return {
    deleteAsset,
    moveRenderJobToAssets,
  };
}
