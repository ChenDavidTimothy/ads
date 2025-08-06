// src/components/editor/edges/filterable-edge.tsx
"use client";

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import type { FlowTracker } from '@/lib/flow/flow-tracking';

interface FilterableEdgeProps extends EdgeProps {
  flowTracker: FlowTracker;
  onEdgeClick: (event: React.MouseEvent, id: string) => void;
  edgeState: {
    isFiltered: boolean;
    isSelected: boolean;
    sourceNodeId: string;
    targetNodeId: string;
  };
}

export function FilterableEdge({ 
  id, 
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, 
  style = {}, markerEnd, markerStart,
  onEdgeClick, edgeState 
}: FilterableEdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  // Build style incrementally to avoid conflicts
  const baseStyle = {
    stroke: '#6b7280', // Default gray
    strokeWidth: 2,
    cursor: 'pointer',
  };

  // Apply state-based styling
  if (edgeState.isSelected) {
    baseStyle.stroke = '#3b82f6'; // blue-500
    baseStyle.strokeWidth = 3;
  } else if (edgeState.isFiltered) {
    baseStyle.stroke = '#eab308'; // yellow-500
    Object.assign(baseStyle, { strokeDasharray: '8 4' }); // Dashed line
  }

  // Merge with original style, preserving ReactFlow defaults
  const finalStyle = {
    ...style, // Original ReactFlow styles
    ...baseStyle, // Our custom styles
  };

  // Filter icon for filtered edges
  const filterIcon = edgeState.isFiltered ? (
    <EdgeLabelRenderer>
      <div
        className="absolute pointer-events-none"
        style={{
          transform: `translate(-50%, -50%) translate(${sourceX + (targetX - sourceX) / 2}px, ${sourceY + (targetY - sourceY) / 2}px)`,
          width: 16,
          height: 16,
          backgroundColor: '#eab308',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: '#1f2937',
          fontWeight: 'bold',
          border: '1px solid #374151',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
        }}
        title="Filtered objects"
      >
        ⚙
      </div>
    </EdgeLabelRenderer>
  ) : null;

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        markerStart={markerStart}
        style={finalStyle}
        onClick={(e) => onEdgeClick(e, id)}
      />
      {filterIcon}
    </>
  );
}