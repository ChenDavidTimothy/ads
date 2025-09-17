// src/components/workspace/flow/components/FlowCanvas.tsx
import React, { useState, useMemo } from 'react';
import 'reactflow/dist/style.css';
import ReactFlow, {
  Background,
  MiniMap,
  ConnectionLineType,
  MarkerType,
  type Edge,
  type Node,
  type NodeTypes,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeDragHandler,
} from 'reactflow';
import type { NodeData } from '@/shared/types';

// Edge and handle styling - ALL edges use identical styling
// CRITICAL: All edges must have identical 3px stroke width for consistency across workspaces
// PORTS: Large hit areas (32px) with visual feedback for zero-precision clicking
const EDGE_STYLES = `
.react-flow__edge-path {
  stroke: var(--edge-stroke) !important;
  stroke-width: 3px !important;
  fill: none !important;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: var(--edge-stroke-selected) !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 6px var(--purple-shadow-medium)) !important;
}

.react-flow__edge:hover .react-flow__edge-path {
  stroke: var(--edge-stroke-hover) !important;
  stroke-width: 4px !important;
  cursor: pointer !important;
}



.react-flow__handle {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  background: var(--surface-2);
  transition: all 120ms ease;
  cursor: crosshair;
  transform-origin: center;
}

.react-flow__handle:hover {
  border-color: var(--node-animation);
  background: var(--purple-shadow-subtle);
  box-shadow: 0 0 12px var(--purple-shadow-medium);
}

.react-flow__handle.react-flow__handle-left { left: -8px; }
.react-flow__handle.react-flow__handle-right { right: -8px; }

/* Large invisible hit area around ports for easy clicking */
.react-flow__handle::before {
  content: '';
  position: absolute;
  width: 32px;
  height: 32px;
  left: -8px;
  top: -8px;
  background: transparent;
  cursor: crosshair;
}

/* Visual feedback when hovering near ports */
.react-flow__handle:hover::after {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  left: -14px;
  top: -14px;
  border: 2px dashed var(--node-animation);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}

.react-flow__node {
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: var(--radius-sm);
}

.react-flow__node.selected {
  border: 1px solid var(--purple-shadow-strong) !important;
  box-shadow: 0 0 20px var(--purple-shadow-medium), 0 4px 12px var(--purple-shadow-subtle) !important;
  outline: none !important;
}

.react-flow__node.selected:focus {
  outline: none !important;
  border: 1px solid var(--purple-shadow-strong) !important;
}

/* Override ReactFlow's built-in selection border to be purple */
.react-flow__node.selected .react-flow__node-selected {
  border-color: var(--purple-shadow-strong) !important;
}

/* Override any remaining ReactFlow selection styles */
.react-flow__node[data-selected="true"] {
  border-color: var(--purple-shadow-strong) !important;
}

.react-flow__connectionline {
  stroke: var(--edge-stroke-hover) !important;
  stroke-width: 4px !important;
  stroke-dasharray: 8 8 !important;
  filter: drop-shadow(0 0 4px var(--purple-shadow-medium)) !important;
}
`;

interface Props {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (params: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onNodesDelete: (nodes: Node[]) => void;
  onEdgesDelete: (edges: Edge[]) => void;
  disableDeletion: boolean;
  onNodeDragStop?: NodeDragHandler;
  onSelectionChange?: (params: { nodes: Node[]; edges: Edge[] }) => void;
}

export function FlowCanvas(props: Props) {
  const {
    nodes,
    edges,
    nodeTypes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onPaneClick,
    onNodesDelete,
    onEdgesDelete,
    disableDeletion,
    onNodeDragStop,
    onSelectionChange,
  } = props;

  const [showMinimap, setShowMinimap] = useState(true);

  // SURGICAL FIX: Pre-compute node colors to avoid string operations during render
  const nodeColorMemo = useMemo(() => {
    const nodeColorMap = new Map<string, string>();

    // Pre-populate color map for current nodes
    nodes.forEach((node) => {
      if (!nodeColorMap.has(node.type!)) {
        const type = node.type!;
        let color = 'var(--node-output)'; // default

        if (type.includes('animation')) color = 'var(--node-animation)';
        else if (type.includes('logic')) color = 'var(--node-logic)';
        else if (type.includes('geometry')) color = 'var(--node-geometry)';
        else if (type.includes('text')) color = 'var(--node-text)';
        else if (type.includes('data')) color = 'var(--node-data)';

        nodeColorMap.set(type, color);
      }
    });

    // Return optimized lookup function
    return (node: Node) => nodeColorMap.get(node.type!) ?? 'var(--node-output)';
  }, [nodes]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: EDGE_STYLES }} />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onEdgeDoubleClick={(event, edge) => {
          onEdgesDelete([edge]);
        }}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        // Edge styling - ALL edges use identical 3px stroke width for consistency
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: 'var(--edge-stroke)', strokeWidth: 3 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: 'var(--edge-stroke-hover)',
          },
        }}
        minZoom={0.1}
        maxZoom={5}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        fitView={nodes.length > 0}
        panOnDrag
        selectionOnDrag
        selectNodesOnDrag={false}
        className="bg-[var(--surface-0)]"
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode={disableDeletion ? null : 'Meta'}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border-secondary)" size={2} gap={20} />

        {/* Custom minimap toggle button - positioned inside ReactFlow */}
        <button
          onClick={() => setShowMinimap(!showMinimap)}
          className="shadow-glass absolute right-4 bottom-4 z-50 rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-1)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)]"
          title="Toggle minimap"
        >
          {showMinimap ? 'Hide Map' : 'Show Map'}
        </button>

        {showMinimap && (
          <MiniMap
            className="shadow-glass rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-1)]"
            nodeColor={nodeColorMemo}
            maskColor="var(--surface-0)"
            style={{
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--glass-shadow)',
            }}
          />
        )}
      </ReactFlow>
    </>
  );
}
