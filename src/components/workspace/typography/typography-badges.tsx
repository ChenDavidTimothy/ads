import React from 'react';

import {
  BindingBadge,
  OverrideBadge as UnifiedOverrideBadge,
} from '@/components/workspace/binding/badges';

export function TypographyBindingBadge({
  nodeId,
  keyName,
  objectId,
}: {
  nodeId: string;
  keyName: string;
  objectId?: string;
}) {
  return <BindingBadge nodeId={nodeId} bindingKey={keyName} objectId={objectId} />;
}

export function TypographyOverrideBadge({
  nodeId,
  keyName,
  objectId,
}: {
  nodeId: string;
  keyName: string;
  objectId?: string;
}) {
  return <UnifiedOverrideBadge nodeId={nodeId} bindingKey={keyName} objectId={objectId} />;
}
