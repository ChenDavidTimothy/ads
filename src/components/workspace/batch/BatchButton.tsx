"use client";

import React from "react";
import { features } from "@/shared/feature-flags";
import { useBatchKeysForField } from "@/hooks/use-batch-keys";

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

  if (!features.batchOverridesUI) return null;
  if (!hasBatchKeys) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      title="Batch overrides"
      className={className}
    >
      <span role="img" aria-label="batch">
        🏷️
      </span>
    </button>
  );
}
