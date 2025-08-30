"use client";

import React, { useMemo, useState, useCallback } from "react";
import type { Node } from "reactflow";
import { useWorkspace } from "./workspace-context";
import { FlowTracker } from "@/lib/flow/flow-tracking";
import type { MediaNodeData } from "@/shared/types/nodes";
import type {
  PerObjectAssignments,
  ObjectAssignments,
} from "@/shared/properties/assignments";
import { NumberField } from "@/components/ui/form-fields";
import { Button } from "@/components/ui/button";
import { SelectionList } from "@/components/ui/selection";
import { BindButton } from "@/components/workspace/binding/bindings";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import {
  BindingBadge,
  OverrideBadge as UnifiedOverrideBadge,
} from "@/components/workspace/binding/badges";
import { AssetSelectionModal } from "./media/asset-selection-modal";
import { Image, ImageOff } from "lucide-react";
import { api } from "@/trpc/react";
import type { AssetResponse } from "@/shared/types/assets";
import NextImage from "next/image";

// Badge Components (following typography pattern)
// Replace bespoke badges with unified badges
const MediaBindingBadge = ({
  nodeId,
  keyName,
  objectId,
}: {
  nodeId: string;
  keyName: string;
  objectId?: string;
}) => <BindingBadge nodeId={nodeId} bindingKey={keyName} objectId={objectId} />;

const MediaOverrideBadge = ({
  nodeId,
  keyName,
  objectId,
}: {
  nodeId: string;
  keyName: string;
  objectId?: string;
}) => (
  <UnifiedOverrideBadge
    nodeId={nodeId}
    bindingKey={keyName}
    objectId={objectId}
  />
);

// Default Properties Component (Center Panel)
function MediaDefaultProperties({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();
  const [showAssetModal, setShowAssetModal] = useState(false);
  const utils = api.useUtils();

  const node = state.flow.nodes.find(
    (n) => n.data?.identifier?.id === nodeId,
  ) as Node<MediaNodeData> | undefined;
  const data = node?.data;
  const bindings = (data?.variableBindings ?? {}) as Record<
    string,
    { target?: string; boundResultNodeId?: string }
  >;

  const def = getNodeDefinition("media")?.defaults ?? {};
  const defImageAssetId = (def.imageAssetId as string) ?? "";

  // Direct assignment pattern (following typography)
  const imageAssetId: string = data?.imageAssetId ?? defImageAssetId;

  const isBound = (key: string) => !!bindings[key]?.boundResultNodeId;

  // Helper to get value for bound fields - blank if bound, normal value if not
  const getValue = function <T>(key: string, defaultValue: T): T | undefined {
    if (isBound(key)) return undefined; // Blank when bound
    return (
      ((data as unknown as Record<string, unknown>)?.[key] as T) ?? defaultValue
    );
  };

  const leftBorderClass = (key: string) =>
    isBound(key) ? "border-l-2 border-[var(--accent-secondary)]" : "";

  // Get current asset details
  const assetDetailsQuery = api.assets.list.useQuery(
    {
      limit: 100, // Get more assets to find the one we need
      offset: 0,
      bucketName: "images", // Only get images since we're looking for image assets
    },
    {
      enabled: !!imageAssetId,
      select: (response) =>
        response.assets.find((asset) => asset.id === imageAssetId),
    },
  );
  const { data: assetDetails, isLoading: isLoadingAssetDetails } =
    assetDetailsQuery;

  const handleAssetSelect = (asset: AssetResponse) => {
    // Update the flow state first
    updateFlow({
      nodes: state.flow.nodes.map((n) =>
        n.data?.identifier?.id !== nodeId
          ? n
          : { ...n, data: { ...n.data, imageAssetId: asset.id } },
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
        n.data?.identifier?.id !== nodeId
          ? n
          : { ...n, data: { ...n.data, imageAssetId: "" } },
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
        <div className="text-sm font-medium text-[var(--text-primary)]">
          Content
        </div>

        {/* Asset Selection */}
        <div className="space-y-[var(--space-2)]">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--text-tertiary)]">
              Image Asset
            </label>
            <BindButton nodeId={nodeId} bindingKey="imageAssetId" />
          </div>

          {/* Current Asset Display */}
          <div
            key={`asset-display-${imageAssetId || "none"}`}
            className="rounded border border-[var(--border-secondary)] bg-[var(--surface-2)] p-[var(--space-3)]"
          >
            {imageAssetId && assetDetails ? (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="h-12 w-12 overflow-hidden rounded bg-[var(--surface-1)]">
                  {assetDetails.public_url && (
                    <NextImage
                      key={`asset-img-${assetDetails.id}`}
                      src={assetDetails.public_url}
                      alt={assetDetails.original_name}
                      width={48}
                      height={48}
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
                  <div className="text-sm text-[var(--text-tertiary)]">
                    Asset not found
                  </div>
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
                    {def.imageAssetId
                      ? "Using default asset"
                      : "No image selected"}
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
            disabled={isBound("imageAssetId")}
            className={`w-full ${leftBorderClass("imageAssetId")}`}
          >
            <Image size={14} className="mr-2" aria-label="Image icon" />
            {imageAssetId ? "Change Image" : "Override Image"}
          </Button>

          {/* Asset Binding Badge - Typography Pattern */}
          {isBound("imageAssetId") && (
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
        <div className="text-sm font-medium text-[var(--text-primary)]">
          Crop Settings
        </div>

        {/* Crop Position Row */}
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="X"
              value={getValue("cropX", 0)}
              onChange={(cropX) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, cropX } },
                  ),
                })
              }
              min={0}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropX" />}
              disabled={isBound("cropX")}
              inputClassName={leftBorderClass("cropX")}
            />
            {/* Badge - Only show when bound */}
            {isBound("cropX") && (
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
              value={getValue("cropY", 0)}
              onChange={(cropY) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, cropY } },
                  ),
                })
              }
              min={0}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="cropY" />}
              disabled={isBound("cropY")}
              inputClassName={leftBorderClass("cropY")}
            />
            {/* Badge - Only show when bound */}
            {isBound("cropY") && (
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
              value={getValue("cropWidth", 0)}
              onChange={(cropWidth) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, cropWidth } },
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindButton nodeId={nodeId} bindingKey="cropWidth" />
              }
              disabled={isBound("cropWidth")}
              inputClassName={leftBorderClass("cropWidth")}
            />
            {/* Badge - Only show when bound */}
            {isBound("cropWidth") && (
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
              value={getValue("cropHeight", 0)}
              onChange={(cropHeight) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, cropHeight } },
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindButton nodeId={nodeId} bindingKey="cropHeight" />
              }
              disabled={isBound("cropHeight")}
              inputClassName={leftBorderClass("cropHeight")}
            />
            {/* Badge - Only show when bound */}
            {isBound("cropHeight") && (
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
        <div className="text-sm font-medium text-[var(--text-primary)]">
          Display Size
        </div>

        {/* Display Size Row */}
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="Width (0=auto)"
              value={getValue("displayWidth", 0)}
              onChange={(displayWidth) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, displayWidth } },
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindButton nodeId={nodeId} bindingKey="displayWidth" />
              }
              disabled={isBound("displayWidth")}
              inputClassName={leftBorderClass("displayWidth")}
            />
            {/* Badge - Only show when bound */}
            {isBound("displayWidth") && (
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
              value={getValue("displayHeight", 0)}
              onChange={(displayHeight) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId
                      ? n
                      : { ...n, data: { ...n.data, displayHeight } },
                  ),
                })
              }
              min={0}
              bindAdornment={
                <BindButton nodeId={nodeId} bindingKey="displayHeight" />
              }
              disabled={isBound("displayHeight")}
              inputClassName={leftBorderClass("displayHeight")}
            />
            {/* Badge - Only show when bound */}
            {isBound("displayHeight") && (
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
        selectedAssetId={
          imageAssetId && imageAssetId !== "" ? imageAssetId : undefined
        }
      />
    </div>
  );
}

// Per-Object Properties Component (Right Panel)
function MediaPerObjectProperties({
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

  const node = state.flow.nodes.find(
    (n) => n.data?.identifier?.id === nodeId,
  ) as Node<MediaNodeData> | undefined;
  const data = node?.data;
  const def = getNodeDefinition("media")?.defaults ?? {};
  const defImageAssetId = (def.imageAssetId as string) ?? "";

  const assignment: ObjectAssignments = assignments[objectId] ?? {};
  const initial = assignment.initial ?? {};
  const base = data ?? ({} as MediaNodeData); // Node-level values as fallback

  // Binding detection
  const isBound = (key: string): boolean => {
    return !!data?.variableBindingsByObject?.[objectId]?.[key]
      ?.boundResultNodeId;
  };
  const isOverridden = (key: string): boolean => {
    return key in initial;
  };

  const leftBorderClass = (key: string) => {
    if (isBound(key)) return "border-l-2 border-[var(--accent-secondary)]";
    if (isOverridden(key)) return "border-l-2 border-[var(--warning-600)]";
    return "";
  };

  // Value resolution with proper precedence (matching geometry nodes)
  const getValue = (key: keyof MediaNodeData, fallbackValue: unknown) => {
    // Check per-object binding first (highest priority)
    if (isBound(key)) return undefined; // Blank when bound (like geometry nodes)

    // Check manual override second (if not bound)
    switch (key) {
      case "imageAssetId":
        return (
          initial.imageAssetId ??
          base.imageAssetId ??
          defImageAssetId ??
          fallbackValue
        );
      case "cropX":
        return initial.cropX ?? base.cropX ?? def.cropX ?? fallbackValue;
      case "cropY":
        return initial.cropY ?? base.cropY ?? def.cropY ?? fallbackValue;
      case "cropWidth":
        return (
          initial.cropWidth ?? base.cropWidth ?? def.cropWidth ?? fallbackValue
        );
      case "cropHeight":
        return (
          initial.cropHeight ??
          base.cropHeight ??
          def.cropHeight ??
          fallbackValue
        );
      case "displayWidth":
        return (
          initial.displayWidth ??
          base.displayWidth ??
          def.displayWidth ??
          fallbackValue
        );
      case "displayHeight":
        return (
          initial.displayHeight ??
          base.displayHeight ??
          def.displayHeight ??
          fallbackValue
        );
      default:
        return fallbackValue;
    }
  };

  // Get current asset details for this object
  const currentAssetId = getValue("imageAssetId", "") as string;
  const assetDetailsQuery = api.assets.list.useQuery(
    {
      limit: 100, // Get more assets to find the one we need
      offset: 0,
      bucketName: "images", // Only get images since we're looking for image assets
    },
    {
      enabled: !!currentAssetId,
      select: (response) =>
        response.assets.find((asset) => asset.id === currentAssetId),
    },
  );
  const { data: assetDetails, isLoading: isLoadingAssetDetails } =
    assetDetailsQuery;

  const handleAssetSelect = (asset: AssetResponse) => {
    onChange({ imageAssetId: asset.id });
    // Invalidate and refetch the asset list to ensure fresh data
    void utils.assets.list.invalidate();
    // Also refetch the specific asset details query
    void assetDetailsQuery.refetch();
  };

  const clearAsset = () => {
    onChange({ imageAssetId: "" });
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="mb-[var(--space-3)] text-sm font-medium text-[var(--text-primary)]">
        Per-Object Media Overrides
      </div>

      {/* Content Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">
          Content
        </div>

        {/* Per-Object Asset Selection */}
        <div className="space-y-[var(--space-2)]">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--text-tertiary)]">
              Image Asset
            </label>
            <BindButton
              nodeId={nodeId}
              bindingKey="imageAssetId"
              objectId={objectId}
            />
          </div>

          {/* Current Asset Display */}
          <div
            key={`asset-display-per-object-${currentAssetId || "none"}`}
            className="rounded border border-[var(--border-secondary)] bg-[var(--surface-2)] p-[var(--space-3)]"
          >
            {currentAssetId && assetDetails ? (
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="h-12 w-12 overflow-hidden rounded bg-[var(--surface-1)]">
                  {assetDetails.public_url && (
                    <NextImage
                      key={`asset-img-per-object-${assetDetails.id}`}
                      src={assetDetails.public_url}
                      alt={assetDetails.original_name}
                      width={48}
                      height={48}
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
                  <div className="text-sm text-[var(--text-tertiary)]">
                    Asset not found
                  </div>
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
                    {base.imageAssetId
                      ? "Using default asset"
                      : "No image selected"}
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
            disabled={isBound("imageAssetId")}
            className={`w-full ${leftBorderClass("imageAssetId")}`}
          >
            <Image size={14} className="mr-2" aria-label="Image icon" />
            {currentAssetId ? "Change Image" : "Override Image"}
          </Button>

          {/* Asset Binding/Override Badge */}
          {(isOverridden("imageAssetId") || isBound("imageAssetId")) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden("imageAssetId") && !isBound("imageAssetId") && (
                  <MediaOverrideBadge
                    nodeId={nodeId}
                    keyName="imageAssetId"
                    objectId={objectId}
                  />
                )}
                {isBound("imageAssetId") && (
                  <MediaBindingBadge
                    nodeId={nodeId}
                    keyName="imageAssetId"
                    objectId={objectId}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crop Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">
          Crop Settings
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="X"
              value={getValue("cropX", 0) as number}
              onChange={(cropX) => onChange({ cropX })}
              min={0}
              bindAdornment={
                <BindButton
                  nodeId={nodeId}
                  bindingKey="cropX"
                  objectId={objectId}
                />
              }
              disabled={isBound("cropX")}
              inputClassName={leftBorderClass("cropX")}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden("cropX") || isBound("cropX")) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden("cropX") && !isBound("cropX") && (
                    <MediaOverrideBadge
                      nodeId={nodeId}
                      keyName="cropX"
                      objectId={objectId}
                    />
                  )}
                  {isBound("cropX") && (
                    <MediaBindingBadge
                      nodeId={nodeId}
                      keyName="cropX"
                      objectId={objectId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <NumberField
              label="Y"
              value={getValue("cropY", 0) as number}
              onChange={(cropY) => onChange({ cropY })}
              min={0}
              bindAdornment={
                <BindButton
                  nodeId={nodeId}
                  bindingKey="cropY"
                  objectId={objectId}
                />
              }
              disabled={isBound("cropY")}
              inputClassName={leftBorderClass("cropY")}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden("cropY") || isBound("cropY")) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden("cropY") && !isBound("cropY") && (
                    <MediaOverrideBadge
                      nodeId={nodeId}
                      keyName="cropY"
                      objectId={objectId}
                    />
                  )}
                  {isBound("cropY") && (
                    <MediaBindingBadge
                      nodeId={nodeId}
                      keyName="cropY"
                      objectId={objectId}
                    />
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
              value={getValue("cropWidth", 0) as number}
              onChange={(cropWidth) => onChange({ cropWidth })}
              min={0}
              bindAdornment={
                <BindButton
                  nodeId={nodeId}
                  bindingKey="cropWidth"
                  objectId={objectId}
                />
              }
              disabled={isBound("cropWidth")}
              inputClassName={leftBorderClass("cropWidth")}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden("cropWidth") || isBound("cropWidth")) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden("cropWidth") && !isBound("cropWidth") && (
                    <MediaOverrideBadge
                      nodeId={nodeId}
                      keyName="cropWidth"
                      objectId={objectId}
                    />
                  )}
                  {isBound("cropWidth") && (
                    <MediaBindingBadge
                      nodeId={nodeId}
                      keyName="cropWidth"
                      objectId={objectId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <NumberField
              label="Height (0=full)"
              value={getValue("cropHeight", 0) as number}
              onChange={(cropHeight) => onChange({ cropHeight })}
              min={0}
              bindAdornment={
                <BindButton
                  nodeId={nodeId}
                  bindingKey="cropHeight"
                  objectId={objectId}
                />
              }
              disabled={isBound("cropHeight")}
              inputClassName={leftBorderClass("cropHeight")}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden("cropHeight") || isBound("cropHeight")) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden("cropHeight") && !isBound("cropHeight") && (
                    <MediaOverrideBadge
                      nodeId={nodeId}
                      keyName="cropHeight"
                      objectId={objectId}
                    />
                  )}
                  {isBound("cropHeight") && (
                    <MediaBindingBadge
                      nodeId={nodeId}
                      keyName="cropHeight"
                      objectId={objectId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Display Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">
          Display Size
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <NumberField
              label="Width (0=auto)"
              value={getValue("displayWidth", 0) as number}
              onChange={(displayWidth) => onChange({ displayWidth })}
              min={0}
              bindAdornment={
                <BindButton
                  nodeId={nodeId}
                  bindingKey="displayWidth"
                  objectId={objectId}
                />
              }
              disabled={isBound("displayWidth")}
              inputClassName={leftBorderClass("displayWidth")}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden("displayWidth") || isBound("displayWidth")) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden("displayWidth") && !isBound("displayWidth") && (
                    <MediaOverrideBadge
                      nodeId={nodeId}
                      keyName="displayWidth"
                      objectId={objectId}
                    />
                  )}
                  {isBound("displayWidth") && (
                    <MediaBindingBadge
                      nodeId={nodeId}
                      keyName="displayWidth"
                      objectId={objectId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <NumberField
              label="Height (0=auto)"
              value={getValue("displayHeight", 0) as number}
              onChange={(displayHeight) => onChange({ displayHeight })}
              min={0}
              bindAdornment={
                <BindButton
                  nodeId={nodeId}
                  bindingKey="displayHeight"
                  objectId={objectId}
                />
              }
              disabled={isBound("displayHeight")}
              inputClassName={leftBorderClass("displayHeight")}
            />
            {/* Badge - Only show when overridden or bound */}
            {(isOverridden("displayHeight") || isBound("displayHeight")) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden("displayHeight") &&
                    !isBound("displayHeight") && (
                      <MediaOverrideBadge
                        nodeId={nodeId}
                        keyName="displayHeight"
                        objectId={objectId}
                      />
                    )}
                  {isBound("displayHeight") && (
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
        selectedAssetId={
          currentAssetId && currentAssetId !== "" ? currentAssetId : undefined
        }
      />
    </div>
  );
}

// Main Editor Component
export function MediaEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateUI, updateFlow } = useWorkspace();

  // Find the media node and its assignments
  const mediaNode = useMemo(
    () =>
      state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
        | Node<MediaNodeData>
        | undefined,
    [state.flow.nodes, nodeId],
  );

  const assignments: PerObjectAssignments = useMemo(
    () => mediaNode?.data?.perObjectAssignments ?? {},
    [mediaNode],
  );

  // Get upstream image objects (following typography pattern)
  const upstreamObjects = useMemo(() => {
    const tracker = new FlowTracker();
    const objectDescriptors = tracker.getUpstreamObjects(
      nodeId,
      state.flow.nodes,
      state.flow.edges,
    );

    return objectDescriptors
      .filter((obj) => obj.type === "image") // Only show image objects
      .map((obj) => ({
        data: {
          identifier: {
            id: obj.id,
            displayName: obj.displayName,
            type: obj.type,
          },
        },
        type: obj.type,
      }));
  }, [nodeId, state.flow.nodes, state.flow.edges]);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Handle per-object assignment updates
  const handleUpdateAssignment = useCallback(
    (updates: Record<string, unknown>) => {
      if (!selectedObjectId) return;

      const next: PerObjectAssignments = { ...assignments };
      const current: ObjectAssignments = { ...(next[selectedObjectId] ?? {}) };
      const baseInitial = current.initial ?? {};

      // Merge updates into initial assignments
      const mergedInitial = { ...baseInitial, ...updates };

      // Remove undefined values
      Object.keys(mergedInitial).forEach((key) => {
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
          initial: mergedInitial,
        };
      }

      // Update node data
      updateFlow({
        nodes: state.flow.nodes.map((n) =>
          n.data?.identifier?.id !== nodeId
            ? n
            : { ...n, data: { ...n.data, perObjectAssignments: next } },
        ),
      });
    },
    [selectedObjectId, assignments, nodeId, state.flow.nodes, updateFlow],
  );

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Object Selection */}
      <div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-3)]">
        <div className="space-y-[var(--space-3)]">
          <SelectionList
            mode="single"
            items={upstreamObjects.map((obj) => ({
              id: obj.data.identifier.id,
              label: obj.data.identifier.displayName,
            }))}
            selectedId={selectedObjectId}
            onSelect={setSelectedObjectId}
            showDefault={true}
            defaultLabel="Default"
            emptyLabel="No image objects found"
          />

          {/* Show object count for debugging */}
          <div className="border-t border-[var(--border-primary)] pt-[var(--space-2)] text-xs text-[var(--text-tertiary)]">
            Detected: {upstreamObjects.length} image object
            {upstreamObjects.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--surface-1)]/60 px-4">
          <div className="flex items-center gap-3">
            <div className="font-medium text-[var(--text-primary)]">Media</div>
          </div>
          <button
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={() =>
              updateUI({
                activeTab: "flow",
                selectedNodeId: undefined,
                selectedNodeType: undefined,
              })
            }
          >
            Back to Workspace
          </button>
        </div>

        {/* Media Content */}
        <div className="flex-1 p-[var(--space-4)]">
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-2)]">
                <svg
                  className="h-8 w-8 text-[var(--text-tertiary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <div className="mb-[var(--space-2)] text-lg font-medium text-[var(--text-primary)]">
                Batch overrides are available per field and per object
              </div>
              <div className="max-w-sm text-sm text-[var(--text-tertiary)]">
                Select Default or an image object on the left to edit its
                properties.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-[var(--sidebar-width)] overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-4)]">
        <h3 className="mb-[var(--space-4)] text-lg font-semibold text-[var(--text-primary)]">
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
