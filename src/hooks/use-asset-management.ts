"use client";

import { useCallback, useState } from 'react';
import { api } from '@/trpc/react';
import { createBrowserClient } from '@/utils/supabase/client';
import type { 
  AssetResponse, 
  ListAssetsInput,
  GetUploadUrlInput,
  DeleteAssetInput
} from '@/shared/types/assets';
import { 
  validateMimeType, 
  validateFileSize, 
  getBucketForMimeType,
  formatFileSize
} from '@/shared/types/assets';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  assetId?: string;
}

interface UseAssetManagementOptions {
  onUploadSuccess?: (asset: AssetResponse) => void;
  onUploadError?: (error: string, file: File) => void;
  onDeleteSuccess?: (assetId: string) => void;
  onDeleteError?: (error: string) => void;
}

export function useAssetManagement(options: UseAssetManagementOptions = {}) {
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [isDragOver, setIsDragOver] = useState(false);

  const utils = api.useUtils();
  const supabase = createBrowserClient();

  // API mutations
  const getUploadUrlMutation = api.assets.getUploadUrl.useMutation();
  const confirmUploadMutation = api.assets.confirmUpload.useMutation();
  const deleteAssetMutation = api.assets.delete.useMutation({
    onSuccess: (_, variables) => {
      options.onDeleteSuccess?.(variables.assetId);
      // Invalidate queries to refresh the list
      utils.assets.list.invalidate();
      utils.assets.getQuota.invalidate();
    },
    onError: (error) => {
      options.onDeleteError?.(error.message);
    },
  });

  // File validation
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    if (!validateMimeType(file.type)) {
      return {
        valid: false,
        error: `Unsupported file type: ${file.type}. Please upload images or videos only.`,
      };
    }

    if (!validateFileSize(file.size, file.type)) {
      const maxSize = formatFileSize(file.type.startsWith('image/') ? 50 * 1024 * 1024 : 500 * 1024 * 1024);
      return {
        valid: false,
        error: `File size ${formatFileSize(file.size)} exceeds maximum allowed size of ${maxSize}.`,
      };
    }

    return { valid: true };
  }, []);

  // Upload a single file
  const uploadFile = useCallback(async (file: File): Promise<AssetResponse | null> => {
    const fileId = `${file.name}_${Date.now()}`;
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      options.onUploadError?.(validation.error!, file);
      return null;
    }

    // Initialize progress tracking
    setUploadProgress(prev => new Map(prev.set(fileId, {
      file,
      progress: 0,
      status: 'pending',
    })));

    try {
      // Get upload URL
      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        status: 'uploading',
        progress: 10,
      })));

      const uploadUrlData = await getUploadUrlMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      // Upload file to storage
      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        progress: 30,
        assetId: uploadUrlData.assetId,
      })));

      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        progress: 80,
      })));

      // Confirm upload completion
      await confirmUploadMutation.mutateAsync({
        assetId: uploadUrlData.assetId,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        assetType: 'uploaded',
      });

      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        progress: 100,
        status: 'completed',
      })));

      // Invalidate queries to refresh the list
      await utils.assets.list.invalidate();
      await utils.assets.getQuota.invalidate();

      // Get the uploaded asset details
      const assetsData = await utils.assets.list.fetch({ limit: 1, offset: 0 });
      const uploadedAsset = assetsData.assets.find(asset => asset.id === uploadUrlData.assetId);

      if (uploadedAsset) {
        options.onUploadSuccess?.(uploadedAsset);
      }

      // Clean up progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }, 3000);

      return uploadedAsset || null;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setUploadProgress(prev => new Map(prev.set(fileId, {
        ...prev.get(fileId)!,
        status: 'error',
        error: errorMessage,
      })));

      options.onUploadError?.(errorMessage, file);

      // Clean up progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }, 5000);

      return null;
    }
  }, [validateFile, getUploadUrlMutation, confirmUploadMutation, utils, options]);

  // Upload multiple files
  const uploadFiles = useCallback(async (files: File[]): Promise<AssetResponse[]> => {
    const results = await Promise.allSettled(
      files.map(file => uploadFile(file))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<AssetResponse | null> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value!);
  }, [uploadFile]);

  // Delete asset
  const deleteAsset = useCallback(async (assetId: string) => {
    return deleteAssetMutation.mutateAsync({ assetId });
  }, [deleteAssetMutation]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      uploadFiles(droppedFiles);
    }
  }, [uploadFiles]);

  // File input handler
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      uploadFiles(selectedFiles);
    }
    // Clear the input so the same file can be selected again
    e.target.value = '';
  }, [uploadFiles]);

  return {
    // Upload state
    uploadProgress: Array.from(uploadProgress.values()),
    isUploading: Array.from(uploadProgress.values()).some(p => p.status === 'uploading'),
    
    // Drag state
    isDragOver,
    
    // Actions
    uploadFile,
    uploadFiles,
    deleteAsset,
    validateFile,
    
    // Event handlers
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInput,
    
    // Mutation states
    isDeleting: deleteAssetMutation.isPending,
    deleteError: deleteAssetMutation.error?.message,
  };
}
