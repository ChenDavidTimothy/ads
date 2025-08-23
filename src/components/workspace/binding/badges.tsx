"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { useVariableBinding } from "@/components/workspace/binding/bindings";

export function BindingBadge({
  nodeId,
  bindingKey,
  objectId,
}: {
  nodeId: string;
  bindingKey: string;
  objectId?: string;
}) {
  // Per-object and global hooks to allow auto-fallback display + correct removal scope
  const objectBinding = useVariableBinding(nodeId, objectId);
  const globalBinding = useVariableBinding(nodeId);

  const boundIdObject = objectBinding.getBinding(bindingKey);
  const boundIdGlobal = globalBinding.getBinding(bindingKey);

  const isObjectBound = !!boundIdObject;
  const boundId = isObjectBound ? boundIdObject : boundIdGlobal;
  if (!boundId) return null;

  const name = isObjectBound
    ? objectBinding.getBoundName(boundId)
    : globalBinding.getBoundName(boundId);

  return (
    <Badge
      variant="bound"
      onRemove={() =>
        isObjectBound
          ? objectBinding.resetToDefault(bindingKey)
          : globalBinding.resetToDefault(bindingKey)
      }
    >
      {name ? `Bound: ${name}` : "Bound"}
    </Badge>
  );
}

export function OverrideBadge({
  nodeId,
  bindingKey,
  objectId,
}: {
  nodeId: string;
  bindingKey: string;
  objectId?: string;
}) {
  const { resetToDefault } = useVariableBinding(nodeId, objectId);
  return (
    <Badge variant="manual" onRemove={() => resetToDefault(bindingKey)}>
      Manual
    </Badge>
  );
}


