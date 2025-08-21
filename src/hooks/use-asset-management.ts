"use client";

import { useCallback, useState, useEffect, useRef } from 'react';
import { api } from '@/trpc/react';
import type { 
  AssetResponse
} from '@/shared/types/assets';
import { 
  validateMimeType, 
  validateFileSize,
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    };
  }, []);

  // API mutations
  const getUploadUrlMutation = api.assets.getUploadUrl.useMutation();
  const confirmUploadMutation = api.assets.confirmUpload.useMutation();
  const deleteAssetMutation = api.assets.delete.useMutation({
    onSuccess: (_, variables) => {
      options.onDeleteSuccess?.(variables.assetId);
      // Invalidate queries to refresh the list
      void utils.assets.list.invalidate();
      void utils.assets.getQuota.invalidate();
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

      return uploadedAsset ?? null;

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

  // Drag state management with proper debouncing
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Safety timeout to reset stuck drag states
  const resetStuckDragState = useCallback(() => {
    if (isDragOver) {
      setIsDragOver(false);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    }
  }, [isDragOver]);

  // Debounced drag state setter to prevent jitter
  const setDragState = useCallback((isDragging: boolean) => {
    // Clear existing timeout
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    // Clear any existing safety timeout
    if (dragResetTimeoutRef.current) {
      clearTimeout(dragResetTimeoutRef.current);
      dragResetTimeoutRef.current = null;
    }

    const timeout = setTimeout(() => {
      setIsDragOver(isDragging);

      // If setting to true, set a safety timeout to reset if stuck
      if (isDragging) {
        dragResetTimeoutRef.current = setTimeout(() => {
          resetStuckDragState();
        }, 5000); // Reset after 5 seconds if still stuck
      }
    }, isDragging ? 0 : 50); // Immediate for enter, delayed for leave to prevent false positives

    dragTimeoutRef.current = timeout;
  }, [resetStuckDragState]);

  // Drag and drop handlers with proper event handling
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Show drag feedback if any files are being dragged (validate on drop)
    if (e.dataTransfer.types.includes('Files')) {
      // Only update state if it's not already true to prevent unnecessary re-renders
      if (!isDragOver) {
        setDragState(true);
      }
    }
  }, [setDragState, isDragOver]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.types.includes('Files')) {
      // Only update state if it's not already true
      if (!isDragOver) {
        setDragState(true);
      }
    }
  }, [setDragState, isDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // More robust boundary checking
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Check if the mouse is actually leaving the element boundaries
    // Add some tolerance to handle edge cases
    const tolerance = 5;
    if (x < rect.left - tolerance || x > rect.right + tolerance ||
        y < rect.top - tolerance || y > rect.bottom + tolerance) {

      setDragState(false);
    }
  }, [setDragState]);

  // Fallback mouse leave handler to catch stuck states
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    // Only reset if we're not actually dragging (to avoid conflicts)
    if (!e.buttons && isDragOver) {
      // Small delay to ensure this isn't a false positive
      setTimeout(() => {
        if (!e.buttons) { // Double-check
          resetStuckDragState();
        }
      }, 100);
    }
  }, [isDragOver, resetStuckDragState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset drag state
    setDragState(false);

    // Clear any pending timeouts
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    if (dragResetTimeoutRef.current) {
      clearTimeout(dragResetTimeoutRef.current);
      dragResetTimeoutRef.current = null;
    }

    const droppedFiles = Array.from(e.dataTransfer.files);

    if (droppedFiles.length > 0) {
      // Filter out invalid files and show feedback
      const validFiles = droppedFiles.filter(file => {
        const validation = validateFile(file);
        if (!validation.valid) {
          // Show error for invalid files
          options.onUploadError?.(validation.error!, file);
        }
        return validation.valid;
      });

      if (validFiles.length > 0) {
        void uploadFiles(validFiles);
      }
    }
  }, [uploadFiles, setDragState, validateFile, options]);

  // File input handler
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length > 0) {
      void uploadFiles(selectedFiles);
    }
    // Clear the input so the same file can be selected again
    e.target.value = '';
  }, [uploadFiles]);

  // Reset drag state function
  const resetDragState = useCallback(() => {
    setIsDragOver(false);
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    if (dragResetTimeoutRef.current) {
      clearTimeout(dragResetTimeoutRef.current);
      dragResetTimeoutRef.current = null;
    }
  }, []);

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
    resetDragState,

    // Event handlers
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleMouseLeave,
    handleDrop,
    handleFileInput,

    // Mutation states
    isDeleting: deleteAssetMutation.isPending,
    deleteError: deleteAssetMutation.error?.message,
  };
}
