'use client';

import React from 'react';
import { features } from '@/shared/feature-flags';
import { useBatchKeysForField } from '@/hooks/use-batch-keys';

export function BatchButton({
  nodeId,
  fieldPath,
  objectId,
  onOpen,
  className,
}: {
  nodeId: string;
  fieldPath: string;
  objectId?: string;
  onOpen: () => void;
  className?: string;
}) {
  const { hasBatchKeys } = useBatchKeysForField(nodeId, fieldPath, objectId);

  // Debug logging
  console.log('[BatchButton] Debug:', {
    nodeId,
    fieldPath,
    featuresEnabled: features.batchOverridesUI,
    hasBatchKeys,
    willRender: features.batchOverridesUI && hasBatchKeys,
  });

  if (!features.batchOverridesUI) {
    console.log('[BatchButton] Not rendering: feature flag disabled');
    return null;
  }
  if (!hasBatchKeys) {
    console.log('[BatchButton] Not rendering: no batch keys');
    return null;
  }

  return (
    <button type="button" onClick={onOpen} title="Batch overrides" className={className}>
      <span role="img" aria-label="batch">
        🏷️
      </span>
    </button>
  );
}
