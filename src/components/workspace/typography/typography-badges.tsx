import React from 'react';
import type { Node } from 'reactflow';

import { Badge } from '@/components/ui/badge';
import { useVariableBinding } from '@/components/workspace/binding/bindings';
import { useWorkspace } from '@/components/workspace/workspace-context';
import type { TypographyNodeData } from '@/shared/types/nodes';

export function TypographyBindingBadge({
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
    | Node<TypographyNodeData>
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

export function TypographyOverrideBadge({
  nodeId,
  keyName,
  objectId,
}: {
  nodeId: string;
  keyName: string;
  objectId?: string;
}) {
  const { resetToDefault } = useVariableBinding(nodeId, objectId);

  return (
    <Badge variant="manual" onRemove={() => resetToDefault(keyName)}>
      Manual
    </Badge>
  );
}
