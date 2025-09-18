import React from 'react';
import type { Node } from 'reactflow';

import { Badge } from '@/components/ui/badge';
import { OverrideBadge as UnifiedOverrideBadge } from '@/components/workspace/binding/badges';
import { useVariableBinding } from '@/components/workspace/binding/bindings';
import { useWorkspace } from '@/components/workspace/workspace-context';
import type { CanvasNodeData } from '@/shared/types/nodes';

export function CanvasBindingBadge({
  nodeId,
  keyName,
  objectId,
}: {
  nodeId: string;
  keyName: string;
  objectId?: string;
}) {
  const { state } = useWorkspace();
  const { resetToDefault } = useVariableBinding(nodeId, objectId);

  const node = state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
    | Node<CanvasNodeData>
    | undefined;
  if (!node) return null;
  const bound = objectId
    ? (node.data?.variableBindingsByObject?.[objectId]?.[keyName]?.boundResultNodeId ??
      node.data?.variableBindings?.[keyName]?.boundResultNodeId)
    : node.data?.variableBindings?.[keyName]?.boundResultNodeId;
  if (!bound) return null;
  const name = state.flow.nodes.find((n) => n.data?.identifier?.id === bound)?.data?.identifier
    ?.displayName;

  return (
    <Badge variant="bound" onRemove={() => resetToDefault(keyName)}>
      {name ? `Bound: ${name}` : 'Bound'}
    </Badge>
  );
}

export function CanvasOverrideBadge({
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
