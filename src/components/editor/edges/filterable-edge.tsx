// src/components/editor/edges/filterable-edge.tsx
"use client";

import { 
  getBezierPath, 
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge
} from "reactflow";
import { cn } from "@/lib/utils";

interface FilterableEdgeProps extends EdgeProps {
  selected?: boolean;
  onClick?: (event: React.MouseEvent, edge: Edge) => void;
  hasFiltering?: boolean;
  filterCount?: number;
}

export function FilterableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  onClick,
  hasFiltering = false,
  filterCount = 0,
  ...props
}: FilterableEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onClick) {
      onClick(event, { id, ...props } as Edge);
    }
  };

  return (
    <>
      <path
        id={id}
        className={cn(
          "fill-none stroke-2 transition-all cursor-pointer",
          selected 
            ? "stroke-blue-400 stroke-3" 
            : hasFiltering
              ? "stroke-purple-400"
              : "stroke-gray-400 hover:stroke-gray-300"
        )}
        d={edgePath}
        onClick={handleClick}
      />
      
      {hasFiltering && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="flex items-center gap-1"
          >
            <div 
              className={cn(
                "px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all",
                selected 
                  ? "bg-blue-500 text-white" 
                  : "bg-purple-600 text-white hover:bg-purple-500"
              )}
              onClick={handleClick}
            >
              {filterCount > 0 ? `${filterCount} filtered` : "All objects"}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}