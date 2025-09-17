import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { createTRPCContext } from "@/server/api/trpc";
import {
  uploadAssetInputSchema,
  listAssetsInputSchema,
  deleteAssetInputSchema,
  moveToAssetsInputSchema,
  getUploadUrlInputSchema,
  listAssetsResponseSchema,
  uploadUrlResponseSchema,
  storageQuotaResponseSchema,
} from "@/shared/types/assets";
import { logger } from "@/lib/logger";

import { createQuotaService } from "@/server/api/services/assets/quota-service";
import { createAssetUploadService } from "@/server/api/services/assets/upload-service";
import { createAssetCatalogService } from "@/server/api/services/assets/catalog-service";
import { createAssetLifecycleService } from "@/server/api/services/assets/lifecycle-service";
import { AssetsServiceError } from "@/server/api/services/assets/errors";

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;


export const assetsRouter = createTRPCRouter({
  // Get signed upload URL for direct client upload
  getUploadUrl: protectedProcedure
    .input(getUploadUrlInputSchema)
    .output(uploadUrlResponseSchema)
    .mutation(
      async ({
        input,
        ctx,
      }: {
        input: typeof getUploadUrlInputSchema._type;
        ctx: TRPCContext;
      }) => {
        const { supabase, user } = ctx;

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          });
        }

        const quotaService = createQuotaService({ supabase, logger });

        const uploadService = createAssetUploadService({
          supabase,
          quotaService,
          logger,
        });

        try {
          return await uploadService.prepareUpload({
            userId: user.id,
            input,
          });
        } catch (error) {
          handleServiceError(error);
        }
      },
    ),

  // Confirm upload completion and update quota
  confirmUpload: protectedProcedure
    .input(
      uploadAssetInputSchema.extend({
        assetId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx;

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }

      const quotaService = createQuotaService({ supabase, logger });
      const uploadService = createAssetUploadService({
        supabase,
        quotaService,
        logger,
      });

      try {
        return await uploadService.confirmUpload({
          userId: user.id,
          input,
        });
      } catch (error) {
        handleServiceError(error);
      }
    }),

  // List user assets with pagination and filtering
  list: protectedProcedure
    .input(listAssetsInputSchema)
    .output(listAssetsResponseSchema)
    .query(
      async ({
        input,
        ctx,
      }: {
        input: typeof listAssetsInputSchema._type;
        ctx: TRPCContext;
      }) => {
        const { supabase, user } = ctx;

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          });
        }

        const catalogService = createAssetCatalogService({ supabase, logger });

        try {
          return await catalogService.listAssets({
            userId: user.id,
            input,
          });
        } catch (error) {
          handleServiceError(error);
        }
      },
    ),

  // Delete asset and update quota
  delete: protectedProcedure
    .input(deleteAssetInputSchema)
    .mutation(
      async ({
        input,
        ctx,
      }: {
        input: typeof deleteAssetInputSchema._type;
        ctx: TRPCContext;
      }) => {
        const { supabase, user } = ctx;

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          });
        }

        const quotaService = createQuotaService({ supabase, logger });
        const lifecycleService = createAssetLifecycleService({
          supabase,
          quotaService,
          logger,
        });

        try {
          return await lifecycleService.deleteAsset({
            userId: user.id,
            input,
          });
        } catch (error) {
          handleServiceError(error);
        }
      },
    ),

  // Save generated content to permanent assets
  moveToAssets: protectedProcedure
    .input(moveToAssetsInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx;

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }

      const quotaService = createQuotaService({ supabase, logger });
      const lifecycleService = createAssetLifecycleService({
        supabase,
        quotaService,
        logger,
      });

      try {
        return await lifecycleService.moveRenderJobToAssets({
          userId: user.id,
          input,
        });
      } catch (error) {
        handleServiceError(error);
      }
    }),

  // Get user storage quota information
  // Get user storage quota information
  getQuota: protectedProcedure
    .output(storageQuotaResponseSchema)
    .query(async ({ ctx }: { ctx: TRPCContext }) => {
      const { supabase, user } = ctx;

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }

      const quotaService = createQuotaService({ supabase, logger });

      try {
        const quota = await quotaService.getOrCreateUserQuota(user.id);

        const usagePercentage = Math.round(
          (quota.current_usage_bytes / quota.quota_limit_bytes) * 100,
        );
        const remainingBytes = Math.max(
          0,
          quota.quota_limit_bytes - quota.current_usage_bytes,
        );

        return {
          current_usage_bytes: quota.current_usage_bytes,
          quota_limit_bytes: quota.quota_limit_bytes,
          image_count: quota.image_count,
          video_count: quota.video_count,
          usage_percentage: usagePercentage,
          remaining_bytes: remainingBytes,
          updated_at: quota.updated_at,
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),
});

function handleServiceError(error: unknown): never {
  if (error instanceof AssetsServiceError) {
    throw new TRPCError({
      code: error.code,
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof TRPCError) {
    throw error;
  }

  throw error;
}

