"use client";

import { Trash2 } from "lucide-react";
import { memo, useCallback } from "react";
import { useReactFlow } from "reactflow";

interface NodeDeleteButtonProps {
  nodeId: string;
  nodeName: string;
}

// ✅ SIMPLE & EFFECTIVE: Just a delete button, no over-engineering
export const NodeDeleteButton = memo(function NodeDeleteButton({
  nodeId,
  nodeName,
}: NodeDeleteButtonProps) {
  const { deleteElements } = useReactFlow();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      deleteElements({ nodes: [{ id: nodeId }] });
    },
    [nodeId, deleteElements],
  );

  return (
    <button
      onClick={handleClick}
      className="node-delete-button"
      title={`Delete ${nodeName}`}
      aria-label={`Delete ${nodeName}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
});
