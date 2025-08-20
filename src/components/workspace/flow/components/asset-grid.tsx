"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Image, 
  Video, 
  Trash2, 
  MoreVertical, 
  Download,
  Info,
  Calendar,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetResponse } from '@/shared/types/assets';
import { formatFileSize, isImage, isVideo } from '@/shared/types/assets';

interface AssetGridProps {
  assets: AssetResponse[];
  selectedAssetId?: string;
  onAssetSelect?: (asset: AssetResponse) => void;
  onAssetDelete?: (assetId: string) => void;
  isDeleting?: boolean;
  className?: string;
  selectionMode?: boolean; // For asset browser modal
}

export function AssetGrid({
  assets,
  selectedAssetId,
  onAssetSelect,
  onAssetDelete,
  isDeleting = false,
  className,
  selectionMode = false,
}: AssetGridProps) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  if (assets.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="w-16 h-16 bg-[var(--surface-2)] rounded-full flex items-center justify-center mb-4">
          <Image size={24} className="text-[var(--text-tertiary)]" />
        </div>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
          No assets yet
        </h3>
        <p className="text-xs text-[var(--text-tertiary)]">
          Upload images and videos to get started
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          isSelected={selectedAssetId === asset.id}
          isExpanded={expandedAsset === asset.id}
          onSelect={() => onAssetSelect?.(asset)}
          onDelete={() => onAssetDelete?.(asset.id)}
          onToggleExpanded={() => setExpandedAsset(
            expandedAsset === asset.id ? null : asset.id
          )}
          isDeleting={isDeleting}
          selectionMode={selectionMode}
        />
      ))}
    </div>
  );
}

interface AssetCardProps {
  asset: AssetResponse;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onToggleExpanded: () => void;
  isDeleting: boolean;
  selectionMode: boolean;
}

function AssetCard({
  asset,
  isSelected,
  isExpanded,
  onSelect,
  onDelete,
  onToggleExpanded,
  isDeleting,
  selectionMode,
}: AssetCardProps) {
  const handleCardClick = () => {
    if (selectionMode) {
      onSelect();
    } else {
      onToggleExpanded();
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (asset.public_url) {
      const link = document.createElement('a');
      link.href = asset.public_url;
      link.download = asset.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${asset.original_name}"? This action cannot be undone.`)) {
      onDelete();
    }
  };

  const assetDate = new Date(asset.created_at).toLocaleDateString();

  return (
    <div
      className={cn(
        "bg-[var(--surface-1)] border rounded-lg overflow-hidden cursor-pointer transition-all hover:border-[var(--border-primary)]",
        isSelected 
          ? "border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/20" 
          : "border-[var(--border-secondary)]",
        selectionMode && "hover:border-[var(--accent-primary)]"
      )}
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-[var(--surface-2)] relative overflow-hidden">
        {isImage(asset) && asset.public_url ? (
          <img
            src={asset.public_url}
            alt={asset.original_name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : isVideo(asset) ? (
          <div className="w-full h-full flex items-center justify-center">
            <Video size={24} className="text-[var(--text-tertiary)]" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HardDrive size={24} className="text-[var(--text-tertiary)]" />
          </div>
        )}

        {/* File type indicator */}
        <div className="absolute top-2 left-2">
          <div className="w-6 h-6 bg-black/60 rounded flex items-center justify-center">
            {isImage(asset) ? (
              <Image size={12} className="text-white" />
            ) : isVideo(asset) ? (
              <Video size={12} className="text-white" />
            ) : (
              <HardDrive size={12} className="text-white" />
            )}
          </div>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute inset-0 bg-[var(--accent-primary)]/20 border-2 border-[var(--accent-primary)]" />
        )}
      </div>

      {/* Asset info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">
              {asset.original_name}
            </h4>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {formatFileSize(asset.file_size)}
            </p>
          </div>

          {!selectionMode && (
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded();
              }}
            >
              <MoreVertical size={12} />
            </Button>
          )}
        </div>

        {/* Expanded details */}
        {isExpanded && !selectionMode && (
          <div className="mt-3 pt-3 border-t border-[var(--border-primary)] space-y-2">
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <Calendar size={12} />
              <span>Uploaded {assetDate}</span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <Info size={12} />
              <span>{asset.mime_type}</span>
            </div>

            <div className="flex items-center gap-1 pt-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={handleDownload}
                className="flex-1"
              >
                <Download size={12} className="mr-1" />
                Download
              </Button>
              
              <Button
                variant="ghost"
                size="xs"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10"
              >
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
