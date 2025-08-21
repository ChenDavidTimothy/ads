// src/components/workspace/flow/components/assets-panel.tsx
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload } from '@/components/ui/file-upload';
import { AssetGrid } from './asset-grid';
import { useAssetManagement } from '@/hooks/use-asset-management';
import { api } from '@/trpc/react';
import { 
  Search, 
  Image, 
  Video, 
  Upload,
  AlertCircle,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ListAssetsInput } from '@/shared/types/assets';
import { formatFileSize } from '@/shared/types/assets';

type FilterType = 'all' | 'images' | 'videos' | 'uploaded' | 'generated_saved';

export function AssetsPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showUpload, setShowUpload] = useState(false);

  // Asset management hook
  const assetManagement = useAssetManagement({
    onUploadSuccess: () => {
      // Upload success handled by hook invalidating queries
    },
    onUploadError: (error) => {
      console.error('Upload error:', error);
    },
    onDeleteSuccess: () => {
      // Delete success handled by hook invalidating queries  
    },
    onDeleteError: (error) => {
      console.error('Delete error:', error);
    },
  });

  // Build query parameters based on filters
  const queryParams = useMemo((): ListAssetsInput => {
    const params: ListAssetsInput = {
      limit: 50,
      offset: 0,
      assetType: 'all', // Explicitly set default
    };

    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    switch (activeFilter) {
      case 'images':
        params.bucketName = 'images';
        break;
      case 'videos':
        params.bucketName = 'videos';
        break;
      case 'uploaded':
      case 'generated_saved':
        params.assetType = activeFilter;
        break;
      default:
        params.assetType = 'all';
    }

    return params;
  }, [searchQuery, activeFilter]);

  // Fetch assets
  const { 
    data: assetsData, 
    isLoading: isLoadingAssets, 
    error: assetsError,
    refetch: refetchAssets
  } = api.assets.list.useQuery(queryParams);

  // Fetch storage quota
  const { 
    data: quotaData, 
    isLoading: isLoadingQuota 
  } = api.assets.getQuota.useQuery();

  const assets = assetsData?.assets ?? [];
  const isLoading = isLoadingAssets || isLoadingQuota;

  const filterOptions = [
    { id: 'all', label: 'All Assets', icon: HardDrive },
    { id: 'images', label: 'Images', icon: Image },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'uploaded', label: 'Uploaded', icon: Upload },
    { id: 'generated_saved', label: 'Saved Generations', icon: RefreshCw },
  ] as const;

  const handleRefresh = () => {
    void refetchAssets();
  };

  return (
    <div className="h-full flex flex-col space-y-[var(--space-4)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Asset Library
          </h3>
          {quotaData && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {formatFileSize(quotaData.current_usage_bytes)} of {formatFileSize(quotaData.quota_limit_bytes)} used
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={12} className={cn(isLoading && "animate-spin")} />
          </Button>
          
          <Button
            variant={showUpload ? "primary" : "secondary"}
            size="xs"
            onClick={() => setShowUpload(!showUpload)}
          >
            <Upload size={12} className="mr-1" />
            Upload
          </Button>
        </div>
      </div>

      {/* Storage quota bar */}
      {quotaData && (
        <div className="space-y-1">
          <div className="w-full bg-[var(--surface-3)] rounded-full h-1.5">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all",
                quotaData.usage_percentage > 90 
                  ? "bg-[var(--danger-500)]"
                  : quotaData.usage_percentage > 75
                  ? "bg-[var(--warning-600)]"
                  : "bg-[var(--accent-primary)]"
              )}
              style={{ width: `${Math.min(quotaData.usage_percentage, 100)}%` }}
            />
          </div>
          {quotaData.usage_percentage > 90 && (
            <p className="text-xs text-[var(--danger-500)]">
              Storage nearly full
            </p>
          )}
        </div>
      )}

      {/* Upload Section */}
      {showUpload && (
        <div className="border border-[var(--border-primary)] rounded-lg p-4">
          <FileUpload
            onFilesSelected={assetManagement.uploadFiles}
            onDragOver={assetManagement.handleDragOver}
            onDragEnter={assetManagement.handleDragEnter}
            onDragLeave={assetManagement.handleDragLeave}
            onMouseLeave={assetManagement.handleMouseLeave}
            onDrop={assetManagement.handleDrop}
            isDragOver={assetManagement.isDragOver}
            uploadProgress={assetManagement.uploadProgress}
            onResetDragState={assetManagement.resetDragState}
          />
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1">
          {filterOptions.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;
            return (
              <Button
                key={filter.id}
                variant={isActive ? "primary" : "ghost"}
                size="xs"
                onClick={() => setActiveFilter(filter.id as FilterType)}
                className="text-xs"
              >
                <Icon size={10} className="mr-1" />
                {filter.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {assetsError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle size={24} className="text-[var(--danger-500)] mb-2" />
            <p className="text-sm text-[var(--text-primary)] mb-1">
              Failed to load assets
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              {assetsError.message}
            </p>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <AssetGrid
              assets={assets}
              onAssetDelete={assetManagement.deleteAsset}
              isDeleting={assetManagement.isDeleting}
            />
          </div>
        )}
      </div>

      {/* Footer info */}
      {assets.length > 0 && !assetsError && (
        <div className="text-xs text-[var(--text-tertiary)] text-center pt-2 border-t border-[var(--border-primary)]">
          {assets.length} asset{assets.length > 1 ? 's' : ''} shown
          {quotaData && (
            <> • {quotaData.image_count} image{quotaData.image_count !== 1 ? 's' : ''}, {quotaData.video_count} video{quotaData.video_count !== 1 ? 's' : ''}</>
          )}
        </div>
      )}
    </div>
  );
}
