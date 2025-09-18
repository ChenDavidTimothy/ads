import React, { useState } from 'react';
import type { Node } from 'reactflow';

import { NumberField } from '@/components/ui/form-fields';
import { Button } from '@/components/ui/button';
import { RobustImage } from '@/components/ui/robust-image';
import { BindingAndBatchControls } from '@/components/workspace/batch/BindingAndBatchControls';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { getResolverFieldPath } from '@/shared/properties/field-paths';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { MediaNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import { MediaBindingBadge, MediaOverrideBadge } from './media-badges';
import { AssetSelectionModal } from './asset-selection-modal';
import { api } from '@/trpc/react';
import type { AssetResponse } from '@/shared/types/assets';
import { Image, ImageOff } from 'lucide-react';

export function MediaPerObjectProperties({
  nodeId,
  objectId,
  assignments,
  onChange,
}: {
  nodeId: string;
  objectId: string;
  assignments: PerObjectAssignments;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  const { state } = useWorkspace();
  const [showAssetModal, setShowAssetModal] = useState(false);
  const utils = api.useUtils();

  const node = state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
    | Node<MediaNodeData>
    | undefined;
  const data = node?.data;
  const def = getNodeDefinition('media')?.defaults ?? {};
  const defImageAssetId = (def.imageAssetId as string) ?? '';

  const assignment: ObjectAssignments = assignments[objectId] ?? {};
  const initial = assignment.initial ?? {};
  const base = data ?? ({} as MediaNodeData); // Node-level values as fallback

  // Binding detection
  const isBound = (key: string): boolean => {
    return !!data?.variableBindingsByObject?.[objectId]?.[key]?.boundResultNodeId;
  };
  const isOverridden = (key: string): boolean => {
    return key in initial;
  };

  const leftBorderClass = (key: string) => {
    if (isBound(key)) return 'border-l-2 border-[var(--accent-secondary)]';
    if (isOverridden(key)) return 'border-l-2 border-[var(--warning-600)]';
    return '';
  };

  // Value resolution with proper precedence (matching geometry nodes)
  const getValue = (key: keyof MediaNodeData, fallbackValue: unknown) => {
    // Check per-object binding first (highest priority)
    if (isBound(key)) return undefined; // Blank when bound (like geometry nodes)

    // Check manual override second (if not bound)
    switch (key) {
      case 'imageAssetId':
        return initial.imageAssetId ?? base.imageAssetId ?? defImageAssetId ?? fallbackValue;
      case 'cropX':
        return initial.cropX ?? base.cropX ?? def.cropX ?? fallbackValue;
      case 'cropY':
        return initial.cropY ?? base.cropY ?? def.cropY ?? fallbackValue;
      case 'cropWidth':
        return initial.cropWidth ?? base.cropWidth ?? def.cropWidth ?? fallbackValue;
      case 'cropHeight':
        return initial.cropHeight ?? base.cropHeight ?? def.cropHeight ?? fallbackValue;
      case 'displayWidth':
        return initial.displayWidth ?? base.displayWidth ?? def.displayWidth ?? fallbackValue;
      case 'displayHeight':
        return initial.displayHeight ?? base.displayHeight ?? def.displayHeight ?? fallbackValue;
      default:
        return fallbackValue;
    }
  };

  // Get current asset details for this object
  const currentAssetId = getValue('imageAssetId', '') as string;
  const assetDetailsQuery = api.assets.list.useQuery(
    {
      limit: 100, // Get more assets to find the one we need
      offset: 0,
      bucketName: 'images', // Only get images since we're looking for image assets
    },
    {
      enabled: !!currentAssetId,
      select: (response) => response.assets.find((asset) => asset.id === currentAssetId),
    }
  );
  const { data: assetDetails, isLoading: isLoadingAssetDetails } = assetDetailsQuery;

  const handleAssetSelect = (asset: AssetResponse) => {
    onChange({ imageAssetId: asset.id });
    // Invalidate and refetch the asset list to ensure fresh data
    void utils.assets.list.invalidate();
    // Also refetch the specific asset details query
    void assetDetailsQuery.refetch();
  };

  const clearAsset = () => {
    onChange({ imageAssetId: '' });
  };

  // Removed UI: BatchOverridesFoldout

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="mb-[var(--space-3)] text-sm font-medium text-[var(--text-primary)]">
        Per-Object Media Overrides
      </div>

      {/* Content Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Content</div>

        {/* Per-Object Asset Selection */}
        <div className="space-y-[var(--space-2)]">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--text-tertiary)]">Image Asset</label>
            <BindingAndBatchControls
              bindProps={{ nodeId, bindingKey: 'imageAssetId', objectId }}
              batchProps={{
                nodeId,
                fieldPath: getResolverFieldPath('media', 'imageAssetId')!,
                objectId,
                valueType: 'string',
              }}
            />
          </div>

          {/* Current Asset Display */}
          <div
            key={`asset-display-per-object-${currentAssetId || 'none'}`}
            className="rounded border border-[var(--border-secondary)] bg-[var(--surface-2)] p-[var(--space-3)]"
          >
            {currentAssetId && assetDetails ? (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="h-12 w-12 overflow-hidden rounded bg-[var(--surface-1)]">
                  {assetDetails.public_url && (
                    <RobustImage
                      key={`asset-img-per-object-${assetDetails.id}`}
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
            ) : currentAssetId && isLoadingAssetDetails ? (
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
            ) : currentAssetId && !assetDetails && !isLoadingAssetDetails ? (
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
                    {base.imageAssetId ? 'Using default asset' : 'No image selected'}
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
            {currentAssetId ? 'Change Image' : 'Override Image'}
          </Button>

          {/* Asset Binding/Override Badge */}
          {(isOverridden('imageAssetId') || isBound('imageAssetId')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('imageAssetId') && !isBound('imageAssetId') && (
                  <MediaOverrideBadge nodeId={nodeId} keyName="imageAssetId" objectId={objectId} />
                )}
                {isBound('imageAssetId') && (
                  <MediaBindingBadge nodeId={nodeId} keyName="imageAssetId" objectId={objectId} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crop Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Crop Settings</div>

        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="X"
              value={getValue('cropX', 0) as number}
              onChange={(cropX) => onChange({ cropX })}
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'cropX', objectId }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'cropX')!,
                    objectId,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('cropX')}
              inputClassName={leftBorderClass('cropX')}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden('cropX') || isBound('cropX')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('cropX') && !isBound('cropX') && (
                    <MediaOverrideBadge nodeId={nodeId} keyName="cropX" objectId={objectId} />
                  )}
                  {isBound('cropX') && (
                    <MediaBindingBadge nodeId={nodeId} keyName="cropX" objectId={objectId} />
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <NumberField
              label="Y"
              value={getValue('cropY', 0) as number}
              onChange={(cropY) => onChange({ cropY })}
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'cropY', objectId }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'cropY')!,
                    objectId,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('cropY')}
              inputClassName={leftBorderClass('cropY')}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden('cropY') || isBound('cropY')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('cropY') && !isBound('cropY') && (
                    <MediaOverrideBadge nodeId={nodeId} keyName="cropY" objectId={objectId} />
                  )}
                  {isBound('cropY') && (
                    <MediaBindingBadge nodeId={nodeId} keyName="cropY" objectId={objectId} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="Width (0=full)"
              value={getValue('cropWidth', 0) as number}
              onChange={(cropWidth) => onChange({ cropWidth })}
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'cropWidth', objectId }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'cropWidth')!,
                    objectId,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('cropWidth')}
              inputClassName={leftBorderClass('cropWidth')}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden('cropWidth') || isBound('cropWidth')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('cropWidth') && !isBound('cropWidth') && (
                    <MediaOverrideBadge nodeId={nodeId} keyName="cropWidth" objectId={objectId} />
                  )}
                  {isBound('cropWidth') && (
                    <MediaBindingBadge nodeId={nodeId} keyName="cropWidth" objectId={objectId} />
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <NumberField
              label="Height (0=full)"
              value={getValue('cropHeight', 0) as number}
              onChange={(cropHeight) => onChange({ cropHeight })}
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'cropHeight', objectId }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'cropHeight')!,
                    objectId,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('cropHeight')}
              inputClassName={leftBorderClass('cropHeight')}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden('cropHeight') || isBound('cropHeight')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('cropHeight') && !isBound('cropHeight') && (
                    <MediaOverrideBadge nodeId={nodeId} keyName="cropHeight" objectId={objectId} />
                  )}
                  {isBound('cropHeight') && (
                    <MediaBindingBadge nodeId={nodeId} keyName="cropHeight" objectId={objectId} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Display Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Display Size</div>

        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="Width (0=auto)"
              value={getValue('displayWidth', 0) as number}
              onChange={(displayWidth) => onChange({ displayWidth })}
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'displayWidth', objectId }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'displayWidth')!,
                    objectId,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('displayWidth')}
              inputClassName={leftBorderClass('displayWidth')}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden('displayWidth') || isBound('displayWidth')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('displayWidth') && !isBound('displayWidth') && (
                    <MediaOverrideBadge
                      nodeId={nodeId}
                      keyName="displayWidth"
                      objectId={objectId}
                    />
                  )}
                  {isBound('displayWidth') && (
                    <MediaBindingBadge nodeId={nodeId} keyName="displayWidth" objectId={objectId} />
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <NumberField
              label="Height (0=auto)"
              value={getValue('displayHeight', 0) as number}
              onChange={(displayHeight) => onChange({ displayHeight })}
              min={0}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'displayHeight', objectId }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('media', 'displayHeight')!,
                    objectId,
                    valueType: 'number',
                  }}
                />
              }
              disabled={isBound('displayHeight')}
              inputClassName={leftBorderClass('displayHeight')}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden('displayHeight') || isBound('displayHeight')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('displayHeight') && !isBound('displayHeight') && (
                    <MediaOverrideBadge
                      nodeId={nodeId}
                      keyName="displayHeight"
                      objectId={objectId}
                    />
                  )}
                  {isBound('displayHeight') && (
                    <MediaBindingBadge
                      nodeId={nodeId}
                      keyName="displayHeight"
                      objectId={objectId}
                    />
                  )}
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
        selectedAssetId={currentAssetId && currentAssetId !== '' ? currentAssetId : undefined}
      />
    </div>
  );
}
