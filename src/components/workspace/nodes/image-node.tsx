"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { ImageNodeData } from "@/shared/types/nodes";
import { Image, ImageOff } from "lucide-react";
import NextImage from "next/image";
import { api } from "@/trpc/react";
import { useMemo } from "react";

export function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const nodeDefinition = getNodeDefinition('image');
  
  // Fetch asset details if imageAssetId is set
  const { data: assetDetails } = api.assets.list.useQuery(
    { limit: 1, offset: 0 },
    { 
      enabled: !!data.imageAssetId,
      select: (response) => response.assets.find(asset => asset.id === data.imageAssetId)
    }
  );

  const displayInfo = useMemo(() => {
    if (!data.imageAssetId) {
      return {
        name: 'No image selected',
        size: '',
        hasImage: false,
      };
    }

    if (assetDetails) {
      const sizeInKB = Math.round(assetDetails.file_size / 1024);
      return {
        name: assetDetails.original_name,
        size: `${sizeInKB} KB`,
        hasImage: true,
        thumbnail: assetDetails.public_url,
      };
    }

    return {
      name: 'Loading...',
      size: '',
      hasImage: false,
    };
  }, [data.imageAssetId, assetDetails]);

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-input)] flex items-center justify-center rounded text-[var(--text-primary)]">
            {displayInfo.hasImage ? (
              <Image size={12} aria-label="Image loaded" />
            ) : (
              <ImageOff size={12} aria-label="No image" />
            )}
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2 text-xs text-[var(--text-secondary)]">
        {/* Image preview thumbnail */}
        {displayInfo.hasImage && displayInfo.thumbnail ? (
          <div className="w-full h-16 bg-[var(--surface-2)] rounded overflow-hidden relative">
            <NextImage 
              src={displayInfo.thumbnail} 
              alt={displayInfo.name}
              fill
              className="object-cover"
              onError={(e) => {
                // Hide broken images
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-full h-16 bg-[var(--surface-2)] rounded flex items-center justify-center">
            <ImageOff size={16} className="text-[var(--text-tertiary)]" />
          </div>
        )}

        {/* Asset details */}
        <div className="space-y-1">
          <div className="font-mono bg-[var(--surface-2)] p-1 rounded text-[10px] truncate">
            {displayInfo.name}
          </div>
          {displayInfo.size && (
            <div className="flex justify-between">
              <span>Size:</span>
              <span className="text-[var(--text-primary)] font-medium">{displayInfo.size}</span>
            </div>
          )}
          {data.opacity < 1 && (
            <div className="flex justify-between">
              <span>Opacity:</span>
              <span className="text-[var(--text-primary)] font-medium">{Math.round(data.opacity * 100)}%</span>
            </div>
          )}
        </div>
      </CardContent>

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className="w-3 h-3 bg-[var(--node-input)] !border-2 !border-[var(--text-primary)]"
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}
