import React, { useMemo, useState } from 'react';
import type { Node } from 'reactflow';

import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/ui/form-fields';
import { RobustImage } from '@/components/ui/robust-image';
import { BindingAndBatchControls } from '@/components/workspace/batch/BindingAndBatchControls';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { api } from '@/trpc/react';
import type { AssetResponse } from '@/shared/types/assets';
import type { MediaNodeData } from '@/shared/types/nodes';
import { getResolverFieldPath } from '@/shared/properties/field-paths';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { AssetSelectionModal } from './asset-selection-modal';
import { MediaBindingBadge } from './media-badges';
import { Image, ImageOff } from 'lucide-react';

export function MediaDefaultProperties({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();
  const [showAssetModal, setShowAssetModal] = useState(false);
  const utils = api.useUtils();

  const node = state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
    | Node<MediaNodeData>
    | undefined;
  const data = node?.data;
  const bindings = (data?.variableBindings ?? {}) as Record<
    string,
    { target?: string; boundResultNodeId?: string }
  >;

  const def = getNodeDefinition('media')?.defaults ?? {};
  const defImageAssetId = (def.imageAssetId as string) ?? '';

  // Direct assignment pattern (following typography)
  const imageAssetId: string = data?.imageAssetId ?? defImageAssetId;

  const isBound = (key: string) => !!bindings[key]?.boundResultNodeId;

  // Helper to get value for bound fields - blank if bound, normal value if not
  const getValue = function <T>(key: string, defaultValue: T): T | undefined {
    if (isBound(key)) return undefined; // Blank when bound
    return ((data as unknown as Record<string, unknown>)?.[key] as T) ?? defaultValue;
  };

  const leftBorderClass = (key: string) =>
    isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : '';

  // Get current asset details
  const assetDetailsQuery = api.assets.list.useQuery(
    {
      limit: 100, // Get more assets to find the one we need
      offset: 0,
      bucketName: 'images', // Only get images since we're looking for image assets
    },
    {
      enabled: !!imageAssetId,
      select: (response) => response.assets.find((asset) => asset.id === imageAssetId),
    }
  );
  const { data: assetDetails, isLoading: isLoadingAssetDetails } = assetDetailsQuery;

  const handleAssetSelect = (asset: AssetResponse) => {
    // Update the flow state first
    updateFlow({
      nodes: state.flow.nodes.map((n) =>
        n.data?.identifier?.id !== nodeId
          ? n
          : { ...n, data: { ...n.data, imageAssetId: asset.id } }
      ),
    });

    // Invalidate and refetch the asset list to ensure fresh data
    void utils.assets.list.invalidate();
    // Also refetch the specific asset details query
    void assetDetailsQuery.refetch();
  };

  const clearAsset = () => {
    updateFlow({
      nodes: state.flow.nodes.map((n) =>
        n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, imageAssetId: '' } }
      ),
    });
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="mb-[var(--space-3)] text-sm font-medium text-[var(--text-primary)]">
        Per-Object Media Overrides
      </div>

      {/* Content Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Content</div>

        {/* Asset Selection */}
        <div className="space-y-[var(--space-2)]">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--text-tertiary)]">Image Asset</label>
            <BindingAndBatchControls
              bindProps={{ nodeId, bindingKey: 'imageAssetId' }}
              batchProps={{
                nodeId,
                fieldPath: getResolverFieldPath('media', 'imageAssetId')!,
                valueType: 'string',
              }}
            />
          </div>

          {/* Current Asset Display */}
          <div
            key={`asset-display-${imageAssetId || 'none'}`}
            className="rounded border border-[var(--border-secondary)] bg-[var(--surface-2)] p-[var(--space-3)]"
          >
            {imageAssetId && assetDetails ? (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="h-12 w-12 overflow-hidden rounded bg-[var(--surface-1)]">
                  {assetDetails.public_url && (
                    <RobustImage
                      key={`asset-img-${assetDetails.id}`}
                      src={assetDetails.public_url}
                      alt={assetDetails.original_name}
                      variant="asset"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {assetDetails.original_name}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {Math.round(assetDetails.file_size / 1024)} KB
                    {/* ✅ PRESERVE: Show stored dimensions without changing thumbnail behavior */}
                    {assetDetails.image_width &&
                      assetDetails.image_height &&
                      ` • ${assetDetails.image_width}×${assetDetails.image_height}`}
                  </div>
                </div>
                <Button variant="secondary" size="xs" onClick={clearAsset}>
                  Remove
                </Button>
              </div>
            ) : imageAssetId && isLoadingAssetDetails ? (
              // Asset is selected but details are loading
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-[var(--surface-1)]">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-tertiary)]">
                    Loading asset details...
                  </div>
                </div>
              </div>
            ) : imageAssetId && !assetDetails && !isLoadingAssetDetails ? (
              // Asset is selected but not found
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-[var(--surface-1)]">
                  <ImageOff size={16} className="text-[var(--text-tertiary)]" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-tertiary)]">Asset not found</div>
                </div>
                <Button variant="secondary" size="xs" onClick={clearAsset}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-[var(--surface-1)]">
                  <ImageOff size={16} className="text-[var(--text-tertiary)]" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-tertiary)]">
                    {def.imageAssetId ? 'Using default asset' : 'No image selected'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Select Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAssetModal(true)}
            disabled={isBound('imageAssetId')}
            className={`w-full ${leftBorderClass('imageAssetId')}`}
          >
            <Image size={14} className="mr-2" aria-label="Image icon" />
            {imageAssetId ? 'Change Image' : 'Override Image'}
          </Button>

          {/* Asset Binding Badge - Typography Pattern */}
          {isBound('imageAssetId') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <MediaBindingBadge nodeId={nodeId} keyName="imageAssetId" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crop Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Crop Settings</div>

        {/* Crop Position Row */}
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="X"
              value={getValue('cropX', 0)}
              onChange={(cropX) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, cropX } }
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'cropX' }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'cropX')!,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('cropX')}
              inputClassName={leftBorderClass('cropX')}
            />
            {/* Badge - Only show when bound */}
            {isBound('cropX') && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="cropX" />
                </div>
              </div>
            )}
          </div>
          <div>
            <NumberField
              label="Y"
              value={getValue('cropY', 0)}
              onChange={(cropY) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, cropY } }
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'cropY' }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'cropY')!,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('cropY')}
              inputClassName={leftBorderClass('cropY')}
            />
            {/* Badge - Only show when bound */}
            {isBound('cropY') && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="cropY" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Crop Size Row */}
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="Width (0=full)"
              value={getValue('cropWidth', 0)}
              onChange={(cropWidth) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, cropWidth } }
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'cropWidth' }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'cropWidth')!,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('cropWidth')}
              inputClassName={leftBorderClass('cropWidth')}
            />
            {/* Badge - Only show when bound */}
            {isBound('cropWidth') && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="cropWidth" />
                </div>
              </div>
            )}
          </div>
          <div>
            <NumberField
              label="Height (0=full)"
              value={getValue('cropHeight', 0)}
              onChange={(cropHeight) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, cropHeight } }
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'cropHeight' }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'cropHeight')!,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('cropHeight')}
              inputClassName={leftBorderClass('cropHeight')}
            />
            {/* Badge - Only show when bound */}
            {isBound('cropHeight') && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="cropHeight" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Display Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Display Size</div>

        {/* Display Size Row */}
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="Width (0=auto)"
              value={getValue('displayWidth', 0)}
              onChange={(displayWidth) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, displayWidth } }
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'displayWidth' }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'displayWidth')!,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('displayWidth')}
              inputClassName={leftBorderClass('displayWidth')}
            />
            {/* Badge - Only show when bound */}
            {isBound('displayWidth') && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="displayWidth" />
                </div>
              </div>
            )}
          </div>
          <div>
            <NumberField
              label="Height (0=auto)"
              value={getValue('displayHeight', 0)}
              onChange={(displayHeight) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, displayHeight } }
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'displayHeight' }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'displayHeight')!,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('displayHeight')}
              inputClassName={leftBorderClass('displayHeight')}
            />
            {/* Badge - Only show when bound */}
            {isBound('displayHeight') && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="displayHeight" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asset Selection Modal */}
      <AssetSelectionModal
        isOpen={showAssetModal}
        onClose={() => setShowAssetModal(false)}
        onSelect={handleAssetSelect}
        selectedAssetId={imageAssetId && imageAssetId !== '' ? imageAssetId : undefined}
      />
    </div>
  );
}

// Per-Object Properties Component (Right Panel)
