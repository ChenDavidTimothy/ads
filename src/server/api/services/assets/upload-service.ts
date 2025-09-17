import { randomUUID } from "crypto";
import sharp from "sharp";
import type {
  DatabaseResponse,
  DatabaseUserAsset,
  StorageResponse,
  SupabaseClientLike,
} from "./types";
import { AssetsServiceError } from "./errors";
import type { QuotaService } from "./quota-service";
import {
  getBucketForMimeType,
  validateFileSize,
  validateMimeType,
  type GetUploadUrlInput,
  type UploadAssetInput,
} from "@/shared/types/assets";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

interface LoggerLike {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
}

export interface AssetUploadServiceDeps {
  supabase: SupabaseClientLike;
  quotaService: QuotaService;
  logger?: LoggerLike;
  fetchImpl?: typeof fetch;
  metadataProbe?: (buffer: ArrayBuffer) => Promise<{
    width?: number;
    height?: number;
  }>;
  generateId?: () => string;
  now?: () => Date;
}

export interface PrepareUploadParams {
  userId: string;
  input: GetUploadUrlInput;
}

export interface PrepareUploadResult {
  uploadUrl: string;
  assetId: string;
  expiresAt: string;
}

export type ConfirmUploadInput = UploadAssetInput & { assetId: string };

export interface ConfirmUploadParams {
  userId: string;
  input: ConfirmUploadInput;
}

export interface ConfirmUploadResult {
  success: true;
}

export function createAssetUploadService({
  supabase,
  quotaService,
  logger,
  fetchImpl,
  metadataProbe,
  generateId,
  now,
}: AssetUploadServiceDeps) {
  const log = logger ?? console;
  const fetchFn = fetchImpl ?? fetch;
  const idGenerator = generateId ?? randomUUID;
  const nowFn = now ?? (() => new Date());
  const probe = metadataProbe ?? defaultMetadataProbe;

  async function prepareUpload({
    userId,
    input,
  }: PrepareUploadParams): Promise<PrepareUploadResult> {
    if (!validateMimeType(input.mimeType)) {
      throw new AssetsServiceError(
        "BAD_REQUEST",
        `Unsupported file type: ${input.mimeType}`,
      );
    }

    if (!validateFileSize(input.fileSize, input.mimeType)) {
      throw new AssetsServiceError(
        "BAD_REQUEST",
        `File size exceeds limit for ${input.mimeType}`,
      );
    }

    const quota = await quotaService.getOrCreateUserQuota(userId);
    if (quota.current_usage_bytes + input.fileSize > quota.quota_limit_bytes) {
      throw new AssetsServiceError(
        "FORBIDDEN",
        "Storage quota exceeded. Please upgrade or delete some files.",
      );
    }

    const assetId = idGenerator();
    const extension = input.filename.split(".").pop() ?? "";
    const uniqueFilename = `${assetId}.${extension}`;
    const uploadSubdir = `upl_${assetId.replace(/-/g, "")}`;
    const storagePath = `${userId}/${uploadSubdir}/${uniqueFilename}`;
    const bucketName = getBucketForMimeType(input.mimeType);

    const { data: signedUrl, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(storagePath);

    if (error || !signedUrl) {
      throw new AssetsServiceError(
        "INTERNAL_SERVER_ERROR",
        "Failed to create upload URL",
        { cause: error },
      );
    }

    const { error: insertError } = await supabase
      .from("user_assets")
      .insert({
        id: assetId,
        user_id: userId,
        filename: uniqueFilename,
        original_name: input.filename,
        file_size: input.fileSize,
        mime_type: input.mimeType,
        bucket_name: bucketName,
        storage_path: storagePath,
        asset_type: "uploaded" as const,
        metadata: {},
      });

    if (insertError) {
      throw new AssetsServiceError(
        "INTERNAL_SERVER_ERROR",
        "Failed to register asset",
        { cause: insertError },
      );
    }

    return {
      uploadUrl: signedUrl.signedUrl,
      assetId,
      expiresAt: new Date(nowFn().getTime() + ONE_HOUR_IN_MS).toISOString(),
    };
  }

  async function confirmUpload({
    userId,
    input,
  }: ConfirmUploadParams): Promise<ConfirmUploadResult> {
    const assetResult = await supabase
      .from("user_assets")
      .select("*")
      .eq("id", input.assetId)
      .eq("user_id", userId)
      .single();

    const { data: asset, error } = assetResult as DatabaseResponse<DatabaseUserAsset>;

    if (error || !asset) {
      throw new AssetsServiceError("NOT_FOUND", "Asset not found", {
        cause: error,
      });
    }

    if (
      typeof asset.file_size !== "number" ||
      typeof asset.mime_type !== "string"
    ) {
      throw new AssetsServiceError(
        "INTERNAL_SERVER_ERROR",
        "Invalid asset data",
      );
    }

    if (
      asset.mime_type.startsWith("image/") &&
      asset.mime_type !== "image/svg+xml"
    ) {
      try {
        const signed = (await supabase.storage
          .from(asset.bucket_name)
          .createSignedUrl(asset.storage_path, 300)) as DatabaseResponse<
          StorageResponse
        >;

        if (!signed?.data?.signedUrl) {
          log.warn?.(
            `Could not create signed URL for dimension processing: ${asset.storage_path}`,
          );
        } else {
          const response = await fetchFn(signed.data.signedUrl);
          if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status}`);
          }

          const buffer = await response.arrayBuffer();
          const metadata = await probe(buffer);

          if (metadata.width && metadata.height) {
            const { error: updateError } = await supabase
              .from("user_assets")
              .update({
                image_width: metadata.width,
                image_height: metadata.height,
              })
              .eq("id", input.assetId);

            if (updateError) {
              const message =
                (updateError as { message?: string })?.message ?? "unknown";
              log.warn?.(
                `Failed to update image dimensions for ${input.assetId}: ${message}`,
                { error: updateError },
              );
            } else {
              log.info?.(
                `Stored image dimensions for ${input.assetId}: ${metadata.width}x${metadata.height}`,
              );
            }
          } else {
            log.warn?.(
              `Could not extract dimensions from ${input.assetId} - invalid image metadata`,
            );
          }
        }
      } catch (metadataError) {
        log.warn?.(
          `Failed to process image metadata for ${input.assetId}: ${
            metadataError instanceof Error
              ? metadataError.message
              : String(metadataError)
          }`,
          { error: metadataError },
        );
      }
    }

    await quotaService.updateUserQuota({
      userId,
      fileSize: asset.file_size,
      mimeType: asset.mime_type,
      operation: "add",
    });

    return { success: true };
  }

  return {
    prepareUpload,
    confirmUpload,
  };
}

async function defaultMetadataProbe(buffer: ArrayBuffer) {
  return sharp(Buffer.from(buffer)).metadata();
}
