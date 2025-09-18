'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useVariableBinding } from '@/components/workspace/binding/bindings';

export function BindingBadge({
  nodeId,
  bindingKey,
  objectId,
  fallbackBindingKeys = [],
}: {
  nodeId: string;
  bindingKey: string;
  objectId?: string;
  fallbackBindingKeys?: string[];
}) {
  const { getBindingDetails, getBoundName, resetToDefault } = useVariableBinding(nodeId, objectId);

  const keys = [bindingKey, ...fallbackBindingKeys];
  const { scope, key, boundResultNodeId } = getBindingDetails(keys);
  if (!scope || !key || !boundResultNodeId) return null;

  const name = getBoundName(boundResultNodeId);
  const isInherited = scope === 'global' && !!objectId;
  const label = isInherited
    ? name
      ? `Inherited: ${name}`
      : 'Inherited'
    : name
      ? `Bound: ${name}`
      : 'Bound';

  return (
    <Badge
      variant={isInherited ? 'inherited' : 'bound'}
      onRemove={!isInherited ? () => resetToDefault(key) : undefined}
    >
      {label}
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
