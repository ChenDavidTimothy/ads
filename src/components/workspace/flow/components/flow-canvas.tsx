// src/components/workspace/flow/components/FlowCanvas.tsx
import React, { useState } from 'react';
import 'reactflow/dist/style.css';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  ConnectionLineType,
  MarkerType,
  type Edge, 
  type Node, 
  type NodeTypes, 
  type NodeChange, 
  type EdgeChange, 
  type Connection, 
  type NodeDragHandler 
} from 'reactflow';
import type { NodeData } from '@/shared/types';

// Edge and handle styling
const EDGE_STYLES = `
.react-flow__edge-path {
  stroke: rgba(139, 92, 246, 0.6);
  stroke-width: 2px;
  fill: none;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: rgba(139, 92, 246, 1);
  stroke-width: 3px;
  filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.4));
}

.react-flow__edge:hover .react-flow__edge-path {
  stroke: rgba(139, 92, 246, 0.8);
  stroke-width: 2.5px;
}

.react-flow__handle {
  width: 8px;
  height: 8px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  background: var(--surface-2);
  transition: all 120ms ease;
}

.react-flow__handle:hover {
  border-color: rgba(139, 92, 246, 1);
  background: rgba(139, 92, 246, 0.2);
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
  transform: scale(1.2);
}

.react-flow__handle.react-flow__handle-left { left: -4px; }
.react-flow__handle.react-flow__handle-right { right: -4px; }

.react-flow__node {
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: var(--radius-sm);
}

.react-flow__node.selected {
  border: 1px solid rgba(139, 92, 246, 0.8) !important;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.6), 0 4px 12px rgba(139, 92, 246, 0.4) !important;
  outline: none !important;
}

.react-flow__node.selected:focus {
  outline: none !important;
  border: 1px solid rgba(139, 92, 246, 0.8) !important;
}

/* Override ReactFlow's built-in selection border to be purple */
.react-flow__node.selected .react-flow__node-selected {
  border-color: rgba(139, 92, 246, 0.8) !important;
}

/* Override any remaining ReactFlow selection styles */
.react-flow__node[data-selected="true"] {
  border-color: rgba(139, 92, 246, 0.8) !important;
}

.react-flow__connectionline {
  stroke: rgba(139, 92, 246, 0.8);
  stroke-width: 2px;
  stroke-dasharray: 4 4;
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
		onSelectionChange 
	} = props;

	const [showMinimap, setShowMinimap] = useState(true);

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
				onNodeDragStop={onNodeDragStop}
				onSelectionChange={onSelectionChange}
				nodeTypes={nodeTypes}
				
				// Edge styling and zoom configuration
				connectionLineType={ConnectionLineType.SmoothStep}
				defaultEdgeOptions={{
					type: 'smoothstep',
					style: { stroke: 'rgba(139, 92, 246, 0.6)', strokeWidth: 2 },
					markerEnd: {
						type: MarkerType.ArrowClosed,
						width: 12,
						height: 12,
						color: 'rgba(139, 92, 246, 0.8)',
					},
				}}
				
				minZoom={0.1}
				maxZoom={5}
				zoomOnScroll={true}
				zoomOnPinch={true}
				zoomOnDoubleClick={false}
				
				fitView
				panOnDrag
				selectionOnDrag
				selectNodesOnDrag={false}
				className="bg-[var(--surface-0)]"
				deleteKeyCode={['Delete', 'Backspace']}
				multiSelectionKeyCode={disableDeletion ? (null as unknown as string) : 'Meta'}
				proOptions={{ hideAttribution: true }}
			>
				<Background color="rgba(53, 53, 60, 0.3)" size={2} gap={20} />
				
				{/* Custom minimap toggle button - positioned inside ReactFlow */}
				<button
					onClick={() => setShowMinimap(!showMinimap)}
					className="absolute bottom-4 right-4 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--text-secondary)] shadow-glass hover:bg-[var(--surface-2)] transition-colors z-50"
					title="Toggle minimap"
				>
					{showMinimap ? 'Hide Map' : 'Show Map'}
				</button>
				
				{showMinimap && (
					<MiniMap 
						className="bg-[var(--surface-1)] border border-[var(--border-primary)] shadow-glass rounded-[var(--radius-sm)]" 
						nodeColor={(node) => {
							const type = node.type as string;
							if (type?.includes('animation')) return 'rgba(192, 132, 252, 0.8)';
							if (type?.includes('logic')) return 'rgba(96, 165, 250, 0.8)';
							if (type?.includes('geometry')) return 'rgba(244, 114, 182, 0.8)';
							if (type?.includes('data')) return 'rgba(34, 211, 238, 0.8)';
							return 'rgba(167, 139, 250, 0.8)';
						}}
						maskColor="rgba(10, 10, 11, 0.4)"
						style={{
							backgroundColor: 'var(--surface-1)',
							border: '1px solid var(--border-primary)',
							borderRadius: 'var(--radius-sm)',
							boxShadow: 'var(--glass-shadow)'
						}}
					/>
				)}
			</ReactFlow>
		</>
	);
}


