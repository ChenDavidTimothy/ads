"use client";

import React, { useMemo, useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { MediaNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import { NumberField } from '@/components/ui/form-fields';
import { Button } from '@/components/ui/button';
import { SelectionList } from '@/components/ui/selection';
import { BindButton, useVariableBinding } from '@/components/workspace/binding/bindings';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { Badge } from '@/components/ui/badge';
import { AssetSelectionModal } from './media/asset-selection-modal';
import { Image, ImageOff, Settings } from 'lucide-react';
import { api } from '@/trpc/react';
import type { AssetResponse } from '@/shared/types/assets';

// Badge Components (following typography pattern)
function MediaBindingBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
  const { state } = useWorkspace();
  const { resetToDefault } = useVariableBinding(nodeId, objectId);
  
  const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<MediaNodeData> | undefined;
  if (!node) return null;
  
  let bound: string | undefined;
  if (objectId) {
    bound = node.data?.variableBindingsByObject?.[objectId]?.[keyName]?.boundResultNodeId;
  } else {
    bound = node.data?.variableBindings?.[keyName]?.boundResultNodeId;
  }
  if (!bound) return null;
  
  const name = state.flow.nodes.find(n => n.data?.identifier?.id === bound)?.data?.identifier?.displayName;
  
  return (
    <Badge variant="bound" onRemove={() => resetToDefault(keyName)}>
      {name ? `Bound: ${name}` : 'Bound'}
    </Badge>
  );
}

function MediaOverrideBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
  const { resetToDefault } = useVariableBinding(nodeId, objectId);
  
  return (
    <Badge variant="manual" onRemove={() => resetToDefault(keyName)}>
      Manual
    </Badge>
  );
}

// Default Properties Component (Center Panel)
function MediaDefaultProperties({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();
  const [showAssetModal, setShowAssetModal] = useState(false);
  
  const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<MediaNodeData> | undefined;
  const data = (node?.data ?? {}) as Record<string, unknown> & {
    imageAssetId?: string;
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
    displayWidth?: number;
    displayHeight?: number;
    variableBindings?: Record<string, { target?: string; boundResultNodeId?: string }>;
  };
  const bindings = (data.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;

  const def = (getNodeDefinition('media')?.defaults as Record<string, unknown> & {
    imageAssetId?: string;
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
    displayWidth?: number;
    displayHeight?: number;
  }) ?? {};

  // Direct assignment pattern (following typography)
  const imageAssetId = data.imageAssetId ?? def.imageAssetId ?? '';
  const cropX = data.cropX ?? def.cropX ?? 0;
  const cropY = data.cropY ?? def.cropY ?? 0;
  const cropWidth = data.cropWidth ?? def.cropWidth ?? 0;
  const cropHeight = data.cropHeight ?? def.cropHeight ?? 0;
  const displayWidth = data.displayWidth ?? def.displayWidth ?? 0;
  const displayHeight = data.displayHeight ?? def.displayHeight ?? 0;

  const isBound = (key: string) => !!bindings[key]?.boundResultNodeId;
  const leftBorderClass = (key: string) => (
    isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : ''
  );

  // Get current asset details
  const { data: assetDetails } = api.assets.list.useQuery(
    { limit: 1, offset: 0 },
    {
      enabled: !!imageAssetId,
      select: (response) => response.assets.find(asset => asset.id === imageAssetId)
    }
  );

  const handleAssetSelect = (asset: AssetResponse) => {
    updateFlow({
      nodes: state.flow.nodes.map(n =>
        n.data?.identifier?.id !== nodeId ? n :
        ({ ...n, data: { ...n.data, imageAssetId: asset.id } })
      )
    });
  };

  const clearAsset = () => {
    updateFlow({
      nodes: state.flow.nodes.map(n =>
        n.data?.identifier?.id !== nodeId ? n :
        ({ ...n, data: { ...n.data, imageAssetId: '' } })
      )
    });
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
        Per-Object Media Overrides
      </div>
      
      {/* Content Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Content</div>
        
        {/* Asset Selection */}
        <div className="space-y-[var(--space-2)]">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--text-tertiary)]">Image Asset</label>
            <BindButton nodeId={nodeId} bindingKey="imageAssetId" />
          </div>
          
          {/* Current Asset Display */}
          <div className="p-[var(--space-3)] bg-[var(--surface-2)] rounded border border-[var(--border-secondary)]">
            {imageAssetId && assetDetails ? (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="w-12 h-12 bg-[var(--surface-1)] rounded overflow-hidden">
                  {assetDetails.public_url && (
                    <img
                      src={assetDetails.public_url}
                      alt={assetDetails.original_name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text-primary)] font-medium truncate">
                    {assetDetails.original_name}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {Math.round(assetDetails.file_size / 1024)} KB
                  </div>
                </div>
                <Button variant="secondary" size="xs" onClick={clearAsset}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="w-12 h-12 bg-[var(--surface-1)] rounded flex items-center justify-center">
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
            <Image size={14} className="mr-2" />
            {imageAssetId ? 'Change Image' : 'Override Image'}
          </Button>
          
          {/* Asset Binding Badge - Typography Pattern */}
          {isBound('imageAssetId') && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
              value={cropX}
              onChange={(cropX) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, cropX } })) })}
              min={0}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropX" />}
              disabled={isBound('cropX')}
              inputClassName={leftBorderClass('cropX')}
            />
            {/* Badge - Only show when bound */}
            {isBound('cropX') && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="cropX" />
                </div>
              </div>
            )}
          </div>
          <div>
            <NumberField
              label="Y"
              value={cropY}
              onChange={(cropY) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, cropY } })) })}
              min={0}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropY" />}
              disabled={isBound('cropY')}
              inputClassName={leftBorderClass('cropY')}
            />
            {/* Badge - Only show when bound */}
            {isBound('cropY') && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
              value={cropWidth}
              onChange={(cropWidth) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, cropWidth } })) })}
              min={0}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropWidth" />}
              disabled={isBound('cropWidth')}
              inputClassName={leftBorderClass('cropWidth')}
            />
            {/* Badge - Only show when bound */}
            {isBound('cropWidth') && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="cropWidth" />
                </div>
              </div>
            )}
          </div>
          <div>
            <NumberField
              label="Height (0=full)"
              value={cropHeight}
              onChange={(cropHeight) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, cropHeight } })) })}
              min={0}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropHeight" />}
              disabled={isBound('cropHeight')}
              inputClassName={leftBorderClass('cropHeight')}
            />
            {/* Badge - Only show when bound */}
            {isBound('cropHeight') && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
              value={displayWidth}
              onChange={(displayWidth) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, displayWidth } })) })}
              min={0}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="displayWidth" />}
              disabled={isBound('displayWidth')}
              inputClassName={leftBorderClass('displayWidth')}
            />
            {/* Badge - Only show when bound */}
            {isBound('displayWidth') && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <MediaBindingBadge nodeId={nodeId} keyName="displayWidth" />
                </div>
              </div>
            )}
          </div>
          <div>
            <NumberField
              label="Height (0=auto)"
              value={displayHeight}
              onChange={(displayHeight) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, displayHeight } })) })}
              min={0}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="displayHeight" />}
              disabled={isBound('displayHeight')}
              inputClassName={leftBorderClass('displayHeight')}
            />
            {/* Badge - Only show when bound */}
            {isBound('displayHeight') && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
        selectedAssetId={imageAssetId}
      />
    </div>
  );
}

// Per-Object Properties Component (Right Panel)
function MediaPerObjectProperties({
  nodeId,
  objectId,
  assignments,
  onChange
}: {
  nodeId: string;
  objectId: string;
  assignments: PerObjectAssignments;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  const { state } = useWorkspace();
  const [showAssetModal, setShowAssetModal] = useState(false);
  
  const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<MediaNodeData> | undefined;
  const data = (node?.data ?? {}) as MediaNodeData;
  const def = getNodeDefinition('media')?.defaults ?? {};
  
  const assignment: ObjectAssignments = assignments[objectId] ?? {};
  const initial = assignment.initial ?? {};
  const base = data; // Node-level values as fallback

  // Binding detection
  const isBound = (key: string): boolean => {
    return !!(data.variableBindingsByObject?.[objectId]?.[key]?.boundResultNodeId);
  };

  const isOverridden = (key: string): boolean => {
    return key in initial && !isBound(key);
  };

  const leftBorderClass = (key: string) => {
    if (isBound(key)) return 'border-l-2 border-[var(--accent-secondary)]';
    if (isOverridden(key)) return 'border-l-2 border-[var(--warning-600)]';
    return '';
  };

  // Value resolution with proper precedence
  const getValue = (key: keyof MediaNodeData, fallbackValue: unknown) => {
    if (isBound(key)) return fallbackValue; // Show placeholder when bound
    
    switch (key) {
      case 'imageAssetId': return initial.imageAssetId ?? base.imageAssetId ?? def.imageAssetId ?? fallbackValue;
      case 'cropX': return initial.cropX ?? base.cropX ?? def.cropX ?? fallbackValue;
      case 'cropY': return initial.cropY ?? base.cropY ?? def.cropY ?? fallbackValue;
      case 'cropWidth': return initial.cropWidth ?? base.cropWidth ?? def.cropWidth ?? fallbackValue;
      case 'cropHeight': return initial.cropHeight ?? base.cropHeight ?? def.cropHeight ?? fallbackValue;
      case 'displayWidth': return initial.displayWidth ?? base.displayWidth ?? def.displayWidth ?? fallbackValue;
      case 'displayHeight': return initial.displayHeight ?? base.displayHeight ?? def.displayHeight ?? fallbackValue;
      default: return fallbackValue;
    }
  };

  // Get current asset details for this object
  const currentAssetId = getValue('imageAssetId', '') as string;
  const { data: assetDetails } = api.assets.list.useQuery(
    { limit: 1, offset: 0 },
    {
      enabled: !!currentAssetId,
      select: (response) => response.assets.find(asset => asset.id === currentAssetId)
    }
  );

  const handleAssetSelect = (asset: AssetResponse) => {
    onChange({ imageAssetId: asset.id });
  };

  const clearAsset = () => {
    onChange({ imageAssetId: '' });
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
        Per-Object Media Overrides
      </div>
      
      {/* Content Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Content</div>
        
        {/* Per-Object Asset Selection */}
        <div className="space-y-[var(--space-2)]">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--text-tertiary)]">Image Asset</label>
            <BindButton nodeId={nodeId} bindingKey="imageAssetId" objectId={objectId} />
          </div>
          
          {/* Current Asset Display */}
          <div className="p-[var(--space-3)] bg-[var(--surface-2)] rounded border border-[var(--border-secondary)]">
            {currentAssetId && assetDetails ? (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="w-12 h-12 bg-[var(--surface-1)] rounded overflow-hidden">
                  {assetDetails.public_url && (
                    <img
                      src={assetDetails.public_url}
                      alt={assetDetails.original_name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text-primary)] font-medium truncate">
                    {assetDetails.original_name}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {Math.round(assetDetails.file_size / 1024)} KB
                  </div>
                </div>
                <Button variant="secondary" size="xs" onClick={clearAsset}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="w-12 h-12 bg-[var(--surface-1)] rounded flex items-center justify-center">
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
            <Image size={14} className="mr-2" />
            {currentAssetId ? 'Change Image' : 'Override Image'}
          </Button>
          
          {/* Asset Binding Badge - Typography Pattern */}
          {(isOverridden('imageAssetId') || isBound('imageAssetId')) && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('imageAssetId') && !isBound('imageAssetId') && <MediaOverrideBadge nodeId={nodeId} keyName="imageAssetId" objectId={objectId} />}
                <MediaBindingBadge nodeId={nodeId} keyName="imageAssetId" objectId={objectId} />
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
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropX" objectId={objectId} />}
              disabled={isBound('cropX')}
              inputClassName={leftBorderClass('cropX')}
            />
            {/* Badge - Only show when needed */}
            {(isOverridden('cropX') || isBound('cropX')) && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('cropX') && !isBound('cropX') && <MediaOverrideBadge nodeId={nodeId} keyName="cropX" objectId={objectId} />}
                  <MediaBindingBadge nodeId={nodeId} keyName="cropX" objectId={objectId} />
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
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropY" objectId={objectId} />}
              disabled={isBound('cropY')}
              inputClassName={leftBorderClass('cropY')}
            />
            {/* Badge - Only show when needed */}
            {(isOverridden('cropY') || isBound('cropY')) && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('cropY') && !isBound('cropY') && <MediaOverrideBadge nodeId={nodeId} keyName="cropY" objectId={objectId} />}
                  <MediaBindingBadge nodeId={nodeId} keyName="cropY" objectId={objectId} />
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
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropWidth" objectId={objectId} />}
              disabled={isBound('cropWidth')}
              inputClassName={leftBorderClass('cropWidth')}
            />
            {/* Badge - Only show when needed */}
            {(isOverridden('cropWidth') || isBound('cropWidth')) && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('cropWidth') && !isBound('cropWidth') && <MediaOverrideBadge nodeId={nodeId} keyName="cropWidth" objectId={objectId} />}
                  <MediaBindingBadge nodeId={nodeId} keyName="cropWidth" objectId={objectId} />
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
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropHeight" objectId={objectId} />}
              disabled={isBound('cropHeight')}
              inputClassName={leftBorderClass('cropHeight')}
            />
            {/* Badge - Only show when needed */}
            {(isOverridden('cropHeight') || isBound('cropHeight')) && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('cropHeight') && !isBound('cropHeight') && <MediaOverrideBadge nodeId={nodeId} keyName="cropHeight" objectId={objectId} />}
                  <MediaBindingBadge nodeId={nodeId} keyName="cropHeight" objectId={objectId} />
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
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="displayWidth" objectId={objectId} />}
              disabled={isBound('displayWidth')}
              inputClassName={leftBorderClass('displayWidth')}
            />
            {/* Badge - Only show when needed */}
            {(isOverridden('displayWidth') || isBound('displayWidth')) && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('displayWidth') && !isBound('displayWidth') && <MediaOverrideBadge nodeId={nodeId} keyName="displayWidth" objectId={objectId} />}
                  <MediaBindingBadge nodeId={nodeId} keyName="displayWidth" objectId={objectId} />
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
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="displayHeight" objectId={objectId} />}
              disabled={isBound('displayHeight')}
              inputClassName={leftBorderClass('displayHeight')}
            />
            {/* Badge - Only show when needed */}
            {(isOverridden('displayHeight') || isBound('displayHeight')) && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('displayHeight') && !isBound('displayHeight') && <MediaOverrideBadge nodeId={nodeId} keyName="displayHeight" objectId={objectId} />}
                  <MediaBindingBadge nodeId={nodeId} keyName="displayHeight" objectId={objectId} />
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
        selectedAssetId={currentAssetId}
      />
    </div>
  );
}

// Main Editor Component
export function MediaEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();

  // Find the media node and its assignments
  const mediaNode = useMemo(
    () => state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<MediaNodeData> | undefined,
    [state.flow.nodes, nodeId]
  );
  
  const assignments: PerObjectAssignments = useMemo(
    () => mediaNode?.data?.perObjectAssignments ?? {},
    [mediaNode]
  );

  // Get upstream image objects (following typography pattern)
  const upstreamObjects = useMemo(() => {
    const tracker = new FlowTracker();
    const objectDescriptors = tracker.getUpstreamObjects(nodeId, state.flow.nodes, state.flow.edges);
    
    return objectDescriptors
      .filter(obj => obj.type === 'image') // Only show image objects
      .map(obj => ({
        data: {
          identifier: {
            id: obj.id,
            displayName: obj.displayName,
            type: obj.type
          }
        },
        type: obj.type
      }));
  }, [nodeId, state.flow.nodes, state.flow.edges]);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Handle per-object assignment updates
  const handleUpdateAssignment = useCallback((updates: Record<string, unknown>) => {
    if (!selectedObjectId) return;
    
    const next: PerObjectAssignments = { ...assignments };
    const current: ObjectAssignments = { ...(next[selectedObjectId] ?? {}) };
    const baseInitial = (current.initial ?? {}) as Record<string, unknown>;
    
    // Merge updates into initial assignments
    const mergedInitial = { ...baseInitial, ...updates };
    
    // Remove undefined values
    Object.keys(mergedInitial).forEach(key => {
      if (mergedInitial[key] === undefined) {
        delete mergedInitial[key];
      }
    });

    if (Object.keys(mergedInitial).length === 0) {
      // Remove assignment if empty
      delete next[selectedObjectId];
    } else {
      next[selectedObjectId] = {
        ...current,
        initial: mergedInitial
      };
    }

    // Update node data
    updateFlow({
      nodes: state.flow.nodes.map(n =>
        n.data?.identifier?.id !== nodeId ? n :
        ({ ...n, data: { ...n.data, perObjectAssignments: next } })
      )
    });
  }, [selectedObjectId, assignments, nodeId, state.flow.nodes, updateFlow]);

  return (
    <div className="h-full flex bg-[var(--surface-0)]">
      {/* Left Sidebar - Object Selection */}
      <div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] p-[var(--space-4)] bg-[var(--surface-1)] overflow-y-auto">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">
          Objects
        </h3>
        
        <SelectionList
          items={upstreamObjects.map(obj => ({
            id: obj.data.identifier.id,
            label: obj.data.identifier.displayName
          }))}
          selectedId={selectedObjectId}
          onSelect={setSelectedObjectId}
          mode="single"
          showDefault={true}
          defaultLabel="Default"
          emptyLabel="No image objects found"
        />
        
        {upstreamObjects.length === 0 && (
          <div className="mt-[var(--space-4)] p-[var(--space-3)] bg-[var(--surface-2)] rounded border border-[var(--border-secondary)]">
            <div className="text-xs text-[var(--text-tertiary)]">
              Connect image nodes to this media node to see them here.
            </div>
          </div>
        )}
      </div>

      {/* Center Content */}
      <div className="flex-1 min-w-0 p-[var(--space-4)] overflow-y-auto">
        <div className="max-w-2xl">
          <div className="text-center py-[var(--space-8)]">
            <div className="w-16 h-16 bg-[var(--surface-2)] rounded-full flex items-center justify-center mx-auto mb-[var(--space-4)]">
              <Settings size={24} className="text-[var(--text-tertiary)]" />
            </div>
            <div className="text-sm text-[var(--text-tertiary)]">
              Select Default or an image object on the left to edit its properties.
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-[var(--sidebar-width)] border-l border-[var(--border-primary)] p-[var(--space-4)] bg-[var(--surface-1)] overflow-y-auto">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">
          Properties
        </h3>
        
        {selectedObjectId ? (
          <MediaPerObjectProperties
            nodeId={nodeId}
            objectId={selectedObjectId}
            assignments={assignments}
            onChange={handleUpdateAssignment}
          />
        ) : (
          <MediaDefaultProperties nodeId={nodeId} />
        )}
      </div>
    </div>
  );
}
