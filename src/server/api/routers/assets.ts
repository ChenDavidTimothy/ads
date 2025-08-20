import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { createTRPCContext } from "@/server/api/trpc";
import { SmartStorageProvider } from "@/server/storage/smart-storage-provider";
import { 
  uploadAssetInputSchema,
  listAssetsInputSchema,
  deleteAssetInputSchema,
  moveToAssetsInputSchema,
  getUploadUrlInputSchema,
  assetResponseSchema,
  listAssetsResponseSchema,
  uploadUrlResponseSchema,
  storageQuotaResponseSchema,
  getBucketForMimeType,
  validateFileSize,
  validateMimeType,
  type UserAsset,
  type UserStorageQuota,
  type AssetResponse,
  type BucketName
} from "@/shared/types/assets";
import { randomUUID } from "crypto";

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

export const assetsRouter = createTRPCRouter({
  // Get signed upload URL for direct client upload
  getUploadUrl: protectedProcedure
    .input(getUploadUrlInputSchema)
    .output(uploadUrlResponseSchema)
    .mutation(async ({ input, ctx }: { input: typeof getUploadUrlInputSchema._type; ctx: TRPCContext }) => {
      const { supabase, user } = ctx;
      
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }
      
      // Validate file type and size
      if (!validateMimeType(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported file type: ${input.mimeType}`,
        });
      }
      
      if (!validateFileSize(input.fileSize, input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST", 
          message: `File size exceeds limit for ${input.mimeType}`,
        });
      }
      
      // Check storage quota
      const quota = await getOrCreateUserQuota(supabase, user.id);
      if (quota.current_usage_bytes + input.fileSize > quota.quota_limit_bytes) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Storage quota exceeded. Please upgrade or delete some files.",
        });
      }
      
      // Generate unique filename and storage path
      const assetId = randomUUID();
      const extension = input.filename.split('.').pop() ?? '';
      const uniqueFilename = `${assetId}.${extension}`;
      const storagePath = `${user.id}/${uniqueFilename}`;
      const bucketName = getBucketForMimeType(input.mimeType);
      
      // Create signed upload URL
      const { data: signedUrl, error } = await supabase.storage
        .from(bucketName)
        .createSignedUploadUrl(storagePath);
        
      if (error || !signedUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create upload URL",
        });
      }
      
      // Pre-register the asset (will be updated after successful upload)
      const { error: insertError } = await supabase
        .from('user_assets')
        .insert({
          id: assetId,
          user_id: user.id,
          filename: uniqueFilename,
          original_name: input.filename,
          file_size: input.fileSize,
          mime_type: input.mimeType,
          bucket_name: bucketName,
          storage_path: storagePath,
          asset_type: 'uploaded' as const,
          metadata: {},
        });
        
      if (insertError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to register asset",
        });
      }
      
      return {
        uploadUrl: signedUrl.signedUrl,
        assetId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      };
    }),

  // Confirm upload completion and update quota
  confirmUpload: protectedProcedure
    .input(uploadAssetInputSchema.extend({
      assetId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: TRPCContext }) => {
      const { supabase, user } = ctx;
      
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }
      
      // Verify asset exists and belongs to user
      const { data: asset, error } = await supabase
        .from('user_assets')
        .select('*')
        .eq('id', input.assetId)
        .eq('user_id', user.id)
        .single();
        
      if (error || !asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }
      
      // Update user quota
      await updateUserQuota(supabase, user.id, asset.file_size, asset.mime_type, 'add');
      
      return { success: true };
    }),

  // List user assets with pagination and filtering
  list: protectedProcedure
    .input(listAssetsInputSchema)
    .output(listAssetsResponseSchema)
    .query(async ({ input, ctx }: { input: typeof listAssetsInputSchema._type; ctx: TRPCContext }) => {
      const { supabase, user } = ctx;
      
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }
      
      let query = supabase
        .from('user_assets')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);
      
      // Apply filters
      if (input.assetType && input.assetType !== 'all') {
        query = query.eq('asset_type', input.assetType);
      }
      
      if (input.bucketName) {
        query = query.eq('bucket_name', input.bucketName);
      }
      
      if (input.search) {
        query = query.ilike('original_name', `%${input.search}%`);
      }
      
      const { data: assets, error, count } = await query;
      
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch assets",
        });
      }
      
      // Generate public URLs for assets
      const assetsWithUrls: AssetResponse[] = await Promise.all(
        (assets ?? []).map(async (asset: UserAsset) => {
          const { data: signedUrl } = await supabase.storage
            .from(asset.bucket_name)
            .createSignedUrl(asset.storage_path, 60 * 60 * 24); // 24 hours
            
          return {
            ...asset,
            public_url: signedUrl?.signedUrl,
          };
        })
      );
      
      return {
        assets: assetsWithUrls,
        total: count ?? 0,
        hasMore: (input.offset + input.limit) < (count ?? 0),
      };
    }),

  // Delete asset and update quota
  delete: protectedProcedure
    .input(deleteAssetInputSchema)
    .mutation(async ({ input, ctx }: { input: typeof deleteAssetInputSchema._type; ctx: TRPCContext }) => {
      const { supabase, user } = ctx;
      
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }
      
      // Get asset details first
      const { data: asset, error: fetchError } = await supabase
        .from('user_assets')
        .select('*')
        .eq('id', input.assetId)
        .eq('user_id', user.id)
        .single();
        
      if (fetchError || !asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(asset.bucket_name)
        .remove([asset.storage_path]);
        
      if (storageError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete file from storage",
        });
      }
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('user_assets')
        .delete()
        .eq('id', input.assetId)
        .eq('user_id', user.id);
        
      if (dbError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete asset record",
        });
      }
      
      // Update user quota
      await updateUserQuota(supabase, user.id, asset.file_size, asset.mime_type, 'subtract');
      
      return { success: true };
    }),

  // Move temporary file to permanent assets
  moveToAssets: protectedProcedure
    .input(moveToAssetsInputSchema)
    .mutation(async ({ input, ctx }: { input: any; ctx: TRPCContext }) => {
      const { supabase, user } = ctx;
      
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }
      
      try {
        // 1. Get the render job details
        const { data: renderJob, error: jobError } = await supabase
          .from('render_jobs')
          .select('*')
          .eq('id', input.renderJobId)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .single();

        if (jobError || !renderJob || !renderJob.output_url) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Render job not found or not completed",
          });
        }

        // 2. Parse the signed URL to get bucket and file path
        const { bucket, filePath, mimeType, extension } = parseSignedUrl(renderJob.output_url);
        
        if (!bucket || !filePath) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid output URL format",
          });
        }

        // 3. Get file metadata from storage
        const { data: fileInfo, error: fileError } = await supabase.storage
          .from(bucket)
          .list(user.id, {
            search: filePath.split('/').pop()?.split('.')[0] // Get filename without extension
          });

        if (fileError || !fileInfo || fileInfo.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND", 
            message: "File not found in storage",
          });
        }

        const fileData = fileInfo.find(f => filePath.endsWith(f.name));
        if (!fileData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File metadata not found",
          });
        }

        // 4. Check storage quota before saving
        const quota = await getOrCreateUserQuota(supabase, user.id);
        const fileSize = fileData.metadata?.size || 0;
        
        // Don't count against quota if already generated (already paid for)
        // But still check we have space for the record
        
        // 5. Generate asset details
        const assetId = randomUUID();
        const assetName = input.originalName || `Generated_${Date.now()}.${extension}`;
        
        // 6. Create user_assets record
        const { error: insertError } = await supabase
          .from('user_assets')
          .insert({
            id: assetId,
            user_id: user.id,
            filename: filePath.split('/').pop() || assetName,
            original_name: assetName,
            file_size: fileSize,
            mime_type: mimeType,
            bucket_name: bucket,
            storage_path: filePath,
            asset_type: 'generated_saved' as const,
            metadata: {
              ...input.metadata,
              source: 'render_job',
              render_job_id: input.renderJobId,
              saved_at: new Date().toISOString(),
            },
          });

        if (insertError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save asset record",
          });
        }

        // 7. Update quota to include this asset in permanent storage
        // (even though file already exists, we track it as a permanent asset now)
        await updateUserQuota(supabase, user.id, fileSize, mimeType, 'add');

        console.log('Asset saved successfully', {
          assetId,
          renderJobId: input.renderJobId,
          userId: user.id,
          bucket,
          filePath
        });

        return { 
          success: true, 
          assetId,
          message: `Asset saved as "${assetName}"` 
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('moveToAssets failed', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save asset",
        });
      }
    }),

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
      
      const quota = await getOrCreateUserQuota(supabase, user.id);
      
      const usagePercentage = Math.round((quota.current_usage_bytes / quota.quota_limit_bytes) * 100);
      const remainingBytes = Math.max(0, quota.quota_limit_bytes - quota.current_usage_bytes);
      
      return {
        current_usage_bytes: quota.current_usage_bytes,
        quota_limit_bytes: quota.quota_limit_bytes,
        image_count: quota.image_count,
        video_count: quota.video_count,
        usage_percentage: usagePercentage,
        remaining_bytes: remainingBytes,
        updated_at: quota.updated_at,
      };
    }),
});

// Helper functions
async function getOrCreateUserQuota(supabase: any, userId: string): Promise<UserStorageQuota> {
  const { data: quota, error } = await supabase
    .from('user_storage_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (error && error.code === 'PGRST116') {
    // No quota record exists, create one
    const { data: newQuota, error: createError } = await supabase
      .from('user_storage_quotas')
      .insert({
        user_id: userId,
        current_usage_bytes: 0,
        quota_limit_bytes: 1073741824, // 1GB default
        image_count: 0,
        video_count: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Failed to create quota record:', createError);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create quota record",
      });
    }
    
    if (!newQuota) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Quota record created but no data returned",
      });
    }
    
    return newQuota;
  }
  
  if (error) {
    console.error('Failed to fetch quota:', error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR", 
      message: "Failed to fetch quota",
    });
  }
  
  if (!quota) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No quota data returned",
    });
  }
  
  return quota;
}

async function updateUserQuota(
  supabase: any, 
  userId: string, 
  fileSize: number, 
  mimeType: string, 
  operation: 'add' | 'subtract'
): Promise<void> {
  const isImage = mimeType.startsWith('image/');
  const sizeDelta = operation === 'add' ? fileSize : -fileSize;
  const countDelta = operation === 'add' ? 1 : -1;
  
  // First, get current values
  const { data: currentQuota, error: fetchError } = await supabase
    .from('user_storage_quotas')
    .select('current_usage_bytes, image_count, video_count')
    .eq('user_id', userId)
    .single();
    
  if (fetchError) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch current quota",
    });
  }
  
  // Calculate new values
  const newUsage = currentQuota.current_usage_bytes + sizeDelta;
  const newImageCount = isImage ? currentQuota.image_count + countDelta : currentQuota.image_count;
  const newVideoCount = !isImage ? currentQuota.video_count + countDelta : currentQuota.video_count;
  
  // Update with calculated values
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
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update quota",
    });
  }
}

// Helper function to parse signed URLs
function parseSignedUrl(signedUrl: string): {
  bucket: string | null;
  filePath: string | null;
  mimeType: string;
  extension: string;
} {
  try {
    const url = new URL(signedUrl);
    const pathParts = url.pathname.split('/');
    
    // Supabase storage URLs: /storage/v1/object/sign/{bucket}/{path...}
    const signIndex = pathParts.indexOf('sign');
    if (signIndex === -1 || signIndex + 2 >= pathParts.length) {
      return { bucket: null, filePath: null, mimeType: '', extension: '' };
    }
    
    const bucket = pathParts[signIndex + 1];
    const filePath = pathParts.slice(signIndex + 2).join('/');
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    // Determine MIME type from extension and bucket
    let mimeType = '';
    if (bucket === 'images') {
      const imageTypes: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg', 
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
      };
      mimeType = imageTypes[extension] || 'image/png';
    } else if (bucket === 'videos') {
      const videoTypes: Record<string, string> = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
      };
      mimeType = videoTypes[extension] || 'video/mp4';
    }
    
    return { bucket: bucket || null, filePath: filePath || null, mimeType, extension };
  } catch (error) {
    return { bucket: null, filePath: null, mimeType: '', extension: '' };
  }
}

export type AssetsRouter = typeof assetsRouter;
