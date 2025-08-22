"use client";

import { memo } from "react";
import { NodeDeleteButton } from "./node-delete-button";
import type { NodeProps } from "reactflow";
import type { NodeData } from "@/shared/types/nodes";

// ✅ CRITICAL OPTIMIZATION: Always render for maximum performance
// The real optimization is in stable context values and CSS-only hover
export function withDeleteButton<T extends NodeData>(
  WrappedComponent: React.ComponentType<NodeProps<T>>
) {
  const WithDeleteButtonComponent = memo(function WithDeleteButton(props: NodeProps<T>) {
    return (
      <div className="relative">
        <NodeDeleteButton
          nodeId={props.data.identifier.id}
          nodeName={props.data.identifier.displayName}
        />
        <WrappedComponent {...props} />
      </div>
    );
  });

  WithDeleteButtonComponent.displayName = `withDeleteButton(${WrappedComponent.displayName ?? WrappedComponent.name})`;

  return WithDeleteButtonComponent;
}
