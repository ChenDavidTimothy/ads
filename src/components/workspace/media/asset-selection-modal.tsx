"use client";

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AssetGrid } from '@/components/workspace/flow/components/asset-grid';
import { api } from '@/trpc/react';
import { Search } from 'lucide-react';
import type { AssetResponse } from '@/shared/types/assets';

interface AssetSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: AssetResponse) => void;
  selectedAssetId?: string;
}

export function AssetSelectionModal({
  isOpen,
  onClose,
  onSelect,
  selectedAssetId
}: AssetSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: assetsData, isLoading } = api.assets.list.useQuery({
    limit: 50,
    offset: 0,
    bucketName: 'images', // Only show images
    search: searchQuery.trim() || undefined
  });

  const assets = assetsData?.assets ?? [];

  const handleSelect = (asset: AssetResponse) => {
    onSelect(asset);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Image Asset"
      size="lg"
      variant="glass"
    >
      <div className="p-[var(--space-4)] space-y-[var(--space-4)] h-full flex flex-col">
        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 glass-input"
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-auto scrollbar-elegant">
          {isLoading ? (
            <div className="flex items-center justify-center py-[var(--space-6)]">
              <div className="text-sm text-[var(--text-tertiary)]">Loading assets...</div>
            </div>
          ) : (
            <AssetGrid
              assets={assets}
              selectedAssetId={selectedAssetId}
              onAssetSelect={handleSelect}
              selectionMode={true}
              className="grid-cols-3"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-[var(--space-2)] border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)]">
            {assets.length} image{assets.length !== 1 ? 's' : ''} available
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
