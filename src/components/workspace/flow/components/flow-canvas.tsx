// src/components/workspace/flow/components/FlowCanvas.tsx
import React from 'react';
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

// Enhanced Edge Styling with Custom CSS
const EDGE_STYLES = `
/* Professional straight-line connections with corners */
.react-flow__edge-path {
  stroke: rgba(139, 92, 246, 0.6);
  stroke-width: 2px;
  fill: none;
}

/* Elegant arrow markers */
.react-flow__edge-marker {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
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

/* Enhanced connection handles */
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

.react-flow__handle.react-flow__handle-left {
  left: -4px;
}

.react-flow__handle.react-flow__handle-right {
  right: -4px;
}

/* Professional node selection styling */
.react-flow__node.selected {
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4);
}

/* Connection line preview */
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
				
				// Professional edge styling with elegant arrows
				connectionLineType={ConnectionLineType.SmoothStep}
				defaultEdgeOptions={{
					type: 'smoothstep',
					style: { 
						stroke: 'rgba(139, 92, 246, 0.6)', 
						strokeWidth: 2 
					},
					// Elegant arrow markers showing flow direction
					markerEnd: {
						type: MarkerType.ArrowClosed,
						width: 12,
						height: 12,
						color: 'rgba(139, 92, 246, 0.8)',
					},
				}}
				
				// Enhanced visual settings
				fitView
				panOnDrag
				selectionOnDrag
				zoomOnScroll
				selectNodesOnDrag={false}
				className="bg-[var(--surface-0)]"
				deleteKeyCode={['Delete', 'Backspace']}
				multiSelectionKeyCode={disableDeletion ? (null as unknown as string) : 'Meta'}
			>
				<Background 
					color="rgba(53, 53, 60, 0.3)" 
					size={2}
					gap={20}
				/>
				<Controls 
					className="bg-[var(--surface-1)] border-[var(--border-primary)] shadow-glass" 
					showZoom={true}
					showFitView={true}
					showInteractive={false}
				/>
				<MiniMap 
					className="bg-[var(--surface-1)] border-[var(--border-primary)] shadow-glass" 
					nodeColor={(node) => {
						// Enhanced minimap colors for better visibility
						const type = node.type as string;
						if (type?.includes('animation')) return '#c084fc';
						if (type?.includes('logic')) return '#60a5fa';
						if (type?.includes('geometry')) return '#f472b6';
						if (type?.includes('data')) return '#22d3ee';
						return '#a78bfa';
					}}
					maskColor="rgba(10, 10, 11, 0.8)"
				/>
			</ReactFlow>
		</>
	);
}


