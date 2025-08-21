import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { createTRPCContext } from "@/server/api/trpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import { 
  uploadAssetInputSchema,
  listAssetsInputSchema,
  deleteAssetInputSchema,
  moveToAssetsInputSchema,
  getUploadUrlInputSchema,
  listAssetsResponseSchema,
  uploadUrlResponseSchema,
  storageQuotaResponseSchema,
  getBucketForMimeType,
  validateFileSize,
  validateMimeType,
  type AssetResponse
} from "@/shared/types/assets";
import { randomUUID } from "crypto";

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// Type for Supabase client with proper typing
type TypedSupabaseClient = SupabaseClient;

// Database row types for better type safety
interface DatabaseUserAsset {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  bucket_name: string;
  storage_path: string;
  asset_type: "uploaded" | "generated_saved";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface StorageFileInfo {
  name: string;
  metadata?: {
    size?: number;
  };
}

// Type for Supabase storage response
interface StorageResponse {
  signedUrl: string;
}

// Type for Supabase database response
interface DatabaseResponse<T> {
  data: T | null;
  error: unknown;
}

// Type for quota response
interface QuotaResponse {
  current_usage_bytes: number;
  quota_limit_bytes: number;
  image_count: number;
  video_count: number;
  updated_at: string;
}

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
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx;
      
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }
      
      // Verify asset exists and belongs to user
      const result = await supabase
        .from('user_assets')
        .select('*')
        .eq('id', input.assetId)
        .eq('user_id', user.id)
        .single();
        
      const { data: asset, error } = result as DatabaseResponse<DatabaseUserAsset>;
        
      if (error || !asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }
      
      // Type guard to ensure asset has required properties
      if (typeof asset.file_size !== 'number' || typeof asset.mime_type !== 'string') {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid asset data",
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
      
      const result = await query;
      const { data: assets, error, count } = result;
      
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch assets",
        });
      }
      
      // Type guard to ensure assets array contains valid data
      const typedAssets = (assets ?? []) as DatabaseUserAsset[];
      
      // ✅ CRITICAL FIX: Generate public URLs concurrently with individual timeouts
      const assetsWithUrls: AssetResponse[] = await Promise.all(
        typedAssets.map(async (asset: DatabaseUserAsset) => {
          try {
            // Apply 10 second timeout to each signed URL request
            const signedUrlPromise = supabase.storage
              .from(asset.bucket_name)
              .createSignedUrl(asset.storage_path, 60 * 60 * 24); // 24 hours

            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Signed URL timeout')), 10000);
            });

            const { data: signedUrl } = await Promise.race([
              signedUrlPromise,
              timeoutPromise
            ]) as DatabaseResponse<StorageResponse>;

            return {
              ...asset,
              public_url: signedUrl?.signedUrl,
            };
          } catch (error) {
            // Log error but don't fail entire request
            console.warn(`Failed to generate signed URL for asset ${asset.id}:`, error);
            return {
              ...asset,
              public_url: undefined, // Client handles missing URLs gracefully
            };
          }
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
      const result = await supabase
        .from('user_assets')
        .select('*')
        .eq('id', input.assetId)
        .eq('user_id', user.id)
        .single();
        
      const { data: asset, error: fetchError } = result as DatabaseResponse<DatabaseUserAsset>;
      
      if (fetchError || !asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }
      
      // Type guard to ensure asset has required properties
      if (typeof asset.bucket_name !== 'string' || typeof asset.storage_path !== 'string') {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid asset data",
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
      if (typeof asset.file_size === 'number' && typeof asset.mime_type === 'string') {
        await updateUserQuota(supabase, user.id, asset.file_size, asset.mime_type, 'subtract');
      }
      
      return { success: true };
    }),

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
      
      try {
        // 1. Get the render job details
        const result = await supabase
          .from('render_jobs')
          .select('*')
          .eq('id', input.renderJobId)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .single();

        const { data: renderJob, error: jobError } = result as DatabaseResponse<{ output_url: string }>;

        if (jobError || !renderJob?.output_url) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Render job not found or not completed",
          });
        }

        // Type guard for output_url
        if (typeof renderJob.output_url !== 'string') {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid output URL format",
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

        const fileData = fileInfo.find(f => filePath.endsWith(f.name)) as StorageFileInfo | undefined;
        if (!fileData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File metadata not found",
          });
        }

        // 4. Get file size for asset record
        const fileSize = fileData.metadata?.size ?? 0;
        
        // 5. Generate asset details
        const assetId = randomUUID();
        const assetName = input.originalName ?? `Generated_${Date.now()}.${extension}`;
        
        // 6. Create user_assets record
        const { error: insertError } = await supabase
          .from('user_assets')
          .insert({
            id: assetId,
            user_id: user.id,
            filename: filePath.split('/').pop() ?? assetName,
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

// Helper functions with proper typing
async function getOrCreateUserQuota(supabase: TypedSupabaseClient, userId: string): Promise<QuotaResponse> {
  const result = await supabase
    .from('user_storage_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  const { data: quota, error } = result as DatabaseResponse<QuotaResponse>;
    
  if (error && (error as { code?: string }).code === 'PGRST116') {
    // No quota record exists, create one
    const insertResult = await supabase
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
      
    const { data: newQuota, error: createError } = insertResult as DatabaseResponse<QuotaResponse>;
      
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
    
    // Type guard to ensure newQuota has required properties
    if (typeof newQuota.current_usage_bytes !== 'number' ||
        typeof newQuota.quota_limit_bytes !== 'number' ||
        typeof newQuota.image_count !== 'number' ||
        typeof newQuota.video_count !== 'number' ||
        typeof newQuota.updated_at !== 'string') {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid quota data format",
      });
    }
    
    return {
      current_usage_bytes: newQuota.current_usage_bytes,
      quota_limit_bytes: newQuota.quota_limit_bytes,
      image_count: newQuota.image_count,
      video_count: newQuota.video_count,
      updated_at: newQuota.updated_at,
    };
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
  
  // Type guard to ensure quota has required properties
  if (typeof quota.current_usage_bytes !== 'number' ||
      typeof quota.quota_limit_bytes !== 'number' ||
      typeof quota.image_count !== 'number' ||
      typeof quota.video_count !== 'number' ||
      typeof quota.updated_at !== 'string') {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Invalid quota data format",
    });
  }
  
  return {
    current_usage_bytes: quota.current_usage_bytes,
    quota_limit_bytes: quota.quota_limit_bytes,
    image_count: quota.image_count,
    video_count: quota.video_count,
    updated_at: quota.updated_at,
  };
}

async function updateUserQuota(
  supabase: TypedSupabaseClient, 
  userId: string, 
  fileSize: number, 
  mimeType: string, 
  operation: 'add' | 'subtract'
): Promise<void> {
  const isImage = mimeType.startsWith('image/');
  const sizeDelta = operation === 'add' ? fileSize : -fileSize;
  const countDelta = operation === 'add' ? 1 : -1;
  
  // First, get current values
  const result = await supabase
    .from('user_storage_quotas')
    .select('current_usage_bytes, image_count, video_count')
    .eq('user_id', userId)
    .single();
    
  const { data: currentQuota, error: fetchError } = result as DatabaseResponse<Pick<QuotaResponse, 'current_usage_bytes' | 'image_count' | 'video_count'>>;
    
  if (fetchError) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch current quota",
    });
  }
  
  // Type guard to ensure quota data has required properties
  if (!currentQuota || 
      typeof currentQuota.current_usage_bytes !== 'number' ||
      typeof currentQuota.image_count !== 'number' ||
      typeof currentQuota.video_count !== 'number') {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Invalid quota data format",
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
    const extension = filePath.split('.').pop()?.toLowerCase() ?? '';
    
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
      mimeType = imageTypes[extension] ?? 'image/png';
    } else if (bucket === 'videos') {
      const videoTypes: Record<string, string> = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
      };
      mimeType = videoTypes[extension] ?? 'video/mp4';
    }
    
    return { bucket: bucket ?? null, filePath: filePath ?? null, mimeType, extension };
  } catch {
    return { bucket: null, filePath: null, mimeType: '', extension: '' };
  }
}

export type AssetsRouter = typeof assetsRouter;
